import { z } from 'zod';
import { ok } from '../../lib/envelope.js';
import type { ContactRow } from '../../types/db.js';
import type { ToolDefinition } from '../../types/tools.js';
import { CHANNEL_TYPES } from '../../types/statuses.js';

const InputSchema = z.object({
  channel_type: z.enum(CHANNEL_TYPES),
  channel_value: z.string().min(1).max(255),
  default_restaurant_id: z.string().uuid().optional(),
  full_name: z.string().min(1).max(255).optional(),
  language: z.string().min(2).max(8).optional(),
});

interface OutputData {
  contact_id: string;
  is_new: boolean;
  contact: ContactRow;
}

/**
 * Look up a contact by (channel_type, channel_value). Create one if missing.
 *
 * Why this is the entry point for most agent flows:
 *  - WhatsApp messages identify a person by phone number; we don't know if
 *    they're already in our DB.
 *  - Idempotent by design — replays produce the same contact_id.
 *  - We use contact_channels' UNIQUE(tenant_id, channel_type, channel_value)
 *    as the deduplication key, NOT the contact's email or name.
 */
export const contactsGetOrCreate: ToolDefinition<typeof InputSchema, OutputData> = {
  code: 'contacts.get_or_create',
  moduleCode: 'contacts',
  version: 'v1',
  input: InputSchema,
  async handler({ tx, ctx, input }) {
    // 1. Try to find an existing contact via contact_channels.
    const existing = await tx<Array<ContactRow>>`
      SELECT c.*
      FROM contact_channels cc
      JOIN contacts c ON c.id = cc.contact_id
      WHERE cc.channel_type  = ${input.channel_type}
        AND cc.channel_value = ${input.channel_value}
        AND c.status        != 'merged'
      LIMIT 1
    `;
    if (existing[0]) {
      return ok<OutputData>({
        contact_id: existing[0].id,
        is_new: false,
        contact: existing[0],
      });
    }

    // 2. Create the contact row.
    const created = await tx<Array<ContactRow>>`
      INSERT INTO contacts (
        tenant_id, default_restaurant_id, full_name, language, status
      ) VALUES (
        ${ctx.tenantId},
        ${input.default_restaurant_id ?? null},
        ${input.full_name ?? null},
        ${input.language ?? null},
        'active'
      )
      RETURNING *
    `;
    const contact = created[0]!;

    // 3. Attach the channel. The unique index on
    //    (tenant_id, channel_type, channel_value) protects us against a
    //    racing get_or_create — but that's already handled by tool_executions
    //    idempotency at the wrapTool level.
    await tx`
      INSERT INTO contact_channels (
        tenant_id, contact_id, channel_type, channel_value, is_primary
      ) VALUES (
        ${ctx.tenantId}, ${contact.id}, ${input.channel_type}, ${input.channel_value}, true
      )
    `;

    return ok<OutputData>({
      contact_id: contact.id,
      is_new: true,
      contact,
    });
  },
};
