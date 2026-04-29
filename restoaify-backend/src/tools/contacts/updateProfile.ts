import { z } from 'zod';
import { ok } from '../../lib/envelope.js';
import { notFound } from '../../lib/errors.js';
import { writeAuditLog } from '../../lib/audit.js';
import type { ContactRow } from '../../types/db.js';
import type { ToolDefinition } from '../../types/tools.js';

/**
 * Patch a contact's mutable profile fields. Channels are NOT touched here —
 * use a dedicated tool for channel attach/detach when we add it.
 *
 * Empty patch is rejected: an update with no fields is almost always a
 * caller bug, not a no-op intent.
 *
 * `default_restaurant_id` is intentionally excluded from this schema for
 * v1: changing it has multi-tenant implications (which restaurant does this
 * contact "belong" to by default) that we want to surface as a separate
 * intent, not a side-effect of a profile edit.
 */
const InputSchema = z
  .object({
    contact_id: z.string().uuid(),
    full_name: z.string().min(1).max(255).nullable().optional(),
    first_name: z.string().min(1).max(255).nullable().optional(),
    last_name: z.string().min(1).max(255).nullable().optional(),
    email: z.string().email().max(255).nullable().optional(),
    language: z.string().min(2).max(8).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine(
    ({ contact_id, ...rest }) => Object.keys(rest).length > 0,
    'At least one field besides contact_id must be provided',
  );

interface OutputData {
  contact: ContactRow;
  changed_fields: string[];
}

export const contactsUpdateProfile: ToolDefinition<typeof InputSchema, OutputData> = {
  code: 'contacts.update_profile',
  moduleCode: 'contacts',
  version: 'v1',
  input: InputSchema,
  async handler({ tx, ctx, input }) {
    const before = await tx<ContactRow[]>`
      SELECT * FROM contacts WHERE id = ${input.contact_id} LIMIT 1
    `;
    if (!before[0]) notFound(`Contact ${input.contact_id} not found`);
    const current = before[0];

    // Build the patch dynamically. We do this in JS rather than a giant
    // CASE WHEN ... in SQL because postgres.js's tagged-template helpers
    // (`tx(obj)`) handle the column list / placeholders cleanly.
    const patch: Record<string, string | null> = {};
    const changed: string[] = [];
    const fields = ['full_name', 'first_name', 'last_name', 'email', 'language', 'notes'] as const;

    for (const f of fields) {
      if (f in input && input[f] !== undefined) {
        const next = (input[f] ?? null) as string | null;
        const prev = (current[f] ?? null) as string | null;
        if (next !== prev) {
          patch[f] = next;
          changed.push(f);
        }
      }
    }

    if (changed.length === 0) {
      // Same values as already stored — no-op, but a successful one. We don't
      // write to audit_logs in that case (wrapTool will still log the call).
      return ok<OutputData>({ contact: current, changed_fields: [] });
    }

    const updated = await tx<ContactRow[]>`
      UPDATE contacts
      SET ${tx(patch)}, updated_at = now()
      WHERE id = ${input.contact_id}
      RETURNING *
    `;
    const next = updated[0]!;

    // Domain-level audit row (in addition to the tool-level one written by
    // wrapTool). This is the row UIs and timeline views read from.
    await writeAuditLog(tx, ctx, {
      eventType: 'contact.profile_updated',
      moduleCode: 'contacts',
      toolCode: 'contacts.update_profile',
      entityType: 'contact',
      entityId: input.contact_id,
      action: 'update',
      success: true,
      payloadSummary: `fields: ${changed.join(', ')}`,
      metadata: { changed_fields: changed },
    });

    return ok<OutputData>({ contact: next, changed_fields: changed });
  },
};
