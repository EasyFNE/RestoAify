import { z } from 'zod';
import { ok } from '../../lib/envelope.js';
import { notFound } from '../../lib/errors.js';
import type {
  ContactChannelRow,
  ContactRow,
} from '../../types/db.js';
import type { ToolDefinition } from '../../types/tools.js';
import { CHANNEL_TYPES } from '../../types/statuses.js';

/**
 * Lookup by id OR by (channel_type, channel_value). Exactly one mode required.
 *
 * Why two modes:
 *  - The agent often gets a phone number from a WhatsApp message and needs
 *    to read the profile without first creating the contact. get_or_create
 *    would write; this read-only path doesn't.
 *  - UI screens look up by id once a contact is already on screen.
 */
const InputSchema = z
  .object({
    contact_id: z.string().uuid().optional(),
    channel_type: z.enum(CHANNEL_TYPES).optional(),
    channel_value: z.string().min(1).max(255).optional(),
    include_channels: z.boolean().default(false),
  })
  .refine(
    (v) =>
      Boolean(v.contact_id) !==
      Boolean(v.channel_type && v.channel_value),
    {
      message:
        'Provide either contact_id OR (channel_type + channel_value), not both, not neither',
    },
  );

interface OutputData {
  contact: ContactRow;
  channels?: ContactChannelRow[];
}

export const contactsGetProfile: ToolDefinition<typeof InputSchema, OutputData> = {
  code: 'contacts.get_profile',
  moduleCode: 'contacts',
  version: 'v1',
  input: InputSchema,
  async handler({ tx, input }) {
    let contact: ContactRow | undefined;

    if (input.contact_id) {
      const rows = await tx<ContactRow[]>`
        SELECT * FROM contacts
        WHERE id = ${input.contact_id}
          AND status != 'merged'
        LIMIT 1
      `;
      contact = rows[0];
    } else {
      // channel_type + channel_value path
      const rows = await tx<ContactRow[]>`
        SELECT c.*
        FROM contact_channels cc
        JOIN contacts c ON c.id = cc.contact_id
        WHERE cc.channel_type  = ${input.channel_type!}
          AND cc.channel_value = ${input.channel_value!}
          AND c.status        != 'merged'
        LIMIT 1
      `;
      contact = rows[0];
    }

    if (!contact) notFound('Contact not found');

    const result: OutputData = { contact };

    if (input.include_channels) {
      const channels = await tx<ContactChannelRow[]>`
        SELECT * FROM contact_channels
        WHERE contact_id = ${contact.id}
        ORDER BY is_primary DESC, created_at ASC
      `;
      result.channels = channels;
    }

    return ok<OutputData>(result);
  },
};
