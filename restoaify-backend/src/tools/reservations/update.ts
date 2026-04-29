import { z } from 'zod';
import { fail, ok } from '../../lib/envelope.js';
import { conflict, notFound } from '../../lib/errors.js';
import type { ReservationRow } from '../../types/db.js';
import type { ToolDefinition } from '../../types/tools.js';

const InputSchema = z
  .object({
    reservation_id: z.string().uuid(),
    reservation_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
      .optional(),
    reservation_time: z
      .string()
      .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'HH:MM[:SS]')
      .optional(),
    party_size: z.number().int().positive().max(50).optional(),
    area_preference: z.string().max(100).nullable().optional(),
    special_requests: z.string().max(1000).nullable().optional(),
  })
  .refine(
    ({ reservation_id, ...rest }) => Object.keys(rest).length > 0,
    'At least one field besides reservation_id must be provided',
  );

interface OutputData {
  reservation: ReservationRow;
  changed_fields: string[];
}

const MUTABLE_STATUSES = ['pending', 'confirmed'] as const;

/**
 * Patch a reservation. The hard part is the slot capacity bookkeeping when
 * date/time/party_size change — we model it as a release-then-reserve
 * across one or two slots, all inside the transaction.
 *
 * Capacity ledger walk-through:
 *  - Compute `oldKey = (date, time)` and `newKey = (next_date, next_time)`.
 *  - Compute `oldQty` (current party_size) and `newQty`.
 *  - If oldKey == newKey: net delta on the same slot = newQty - oldQty.
 *      - If positive, check the slot has that much remaining; reject otherwise.
 *      - If negative or zero, just apply.
 *  - If oldKey != newKey: free oldQty on the old slot (clamped at 0),
 *    require capacity for newQty on the new slot, fail if insufficient.
 *
 * Edge: if no slot row exists for old or new key, we skip capacity gating
 * for that side. Restaurants that don't manage slots are unaffected.
 */
export const reservationsUpdate: ToolDefinition<typeof InputSchema, OutputData> = {
  code: 'reservations.update',
  moduleCode: 'reservations',
  version: 'v1',
  input: InputSchema,
  async handler({ tx, input }) {
    const rows = await tx<ReservationRow[]>`
      SELECT * FROM reservations WHERE id = ${input.reservation_id} LIMIT 1
    `;
    const r = rows[0];
    if (!r) notFound(`Reservation ${input.reservation_id} not found`);

    if (!MUTABLE_STATUSES.includes(r.status as 'pending' | 'confirmed')) {
      conflict(
        `Cannot update a reservation in status '${r.status}'`,
        { status: r.status, mutable_from: MUTABLE_STATUSES },
      );
    }

    const nextDate = input.reservation_date ?? r.reservation_date;
    const nextTime = input.reservation_time ?? r.reservation_time;
    const nextPartySize = input.party_size ?? r.party_size;

    const oldKey = `${r.reservation_date} ${r.reservation_time}`;
    const newKey = `${nextDate} ${nextTime}`;
    const slotChanged = oldKey !== newKey;
    const partyChanged = nextPartySize !== r.party_size;

    if (slotChanged || partyChanged) {
      // Look up old and new slots (if they exist).
      const oldSlotRows = await tx<
        Array<{ id: string; capacity_total: number; capacity_reserved: number; status: string }>
      >`
        SELECT id, capacity_total, capacity_reserved, status
        FROM reservation_slots
        WHERE restaurant_id = ${r.restaurant_id}
          AND slot_date     = ${r.reservation_date}
          AND slot_time     = ${r.reservation_time}
        LIMIT 1
      `;
      const oldSlot = oldSlotRows[0];

      const newSlotRows = await tx<
        Array<{ id: string; capacity_total: number; capacity_reserved: number; status: string }>
      >`
        SELECT id, capacity_total, capacity_reserved, status
        FROM reservation_slots
        WHERE restaurant_id = ${r.restaurant_id}
          AND slot_date     = ${nextDate}
          AND slot_time     = ${nextTime}
        LIMIT 1
      `;
      const newSlot = newSlotRows[0];

      if (newSlot && newSlot.status !== 'open') {
        return fail<OutputData>(
          'CONFLICT',
          `Target slot is ${newSlot.status}`,
          { slot_status: newSlot.status },
        );
      }

      if (slotChanged) {
        // Release fully on old, occupy fully on new.
        if (newSlot) {
          const remaining = newSlot.capacity_total - newSlot.capacity_reserved;
          if (nextPartySize > remaining) {
            return fail<OutputData>(
              'CONFLICT',
              'Target slot does not have enough remaining capacity',
              { needed: nextPartySize, available: remaining },
            );
          }
        }
        if (oldSlot) {
          await tx`
            UPDATE reservation_slots
            SET capacity_reserved = GREATEST(0, capacity_reserved - ${r.party_size}),
                updated_at        = now()
            WHERE id = ${oldSlot.id}
          `;
        }
        if (newSlot) {
          await tx`
            UPDATE reservation_slots
            SET capacity_reserved = capacity_reserved + ${nextPartySize},
                updated_at        = now()
            WHERE id = ${newSlot.id}
          `;
        }
      } else {
        // Same slot, party_size delta only.
        const delta = nextPartySize - r.party_size;
        if (newSlot && delta > 0) {
          const remaining = newSlot.capacity_total - newSlot.capacity_reserved;
          if (delta > remaining) {
            return fail<OutputData>(
              'CONFLICT',
              'Slot does not have enough remaining capacity for the larger party',
              { delta, available: remaining },
            );
          }
        }
        if (newSlot) {
          await tx`
            UPDATE reservation_slots
            SET capacity_reserved = GREATEST(0, capacity_reserved + ${delta}),
                updated_at        = now()
            WHERE id = ${newSlot.id}
          `;
        }
      }
    }

    // Build patch.
    const patch: Record<string, string | number | null> = {};
    const changed: string[] = [];

    if (input.reservation_date && input.reservation_date !== r.reservation_date) {
      patch.reservation_date = input.reservation_date;
      changed.push('reservation_date');
    }
    if (input.reservation_time && input.reservation_time !== r.reservation_time) {
      patch.reservation_time = input.reservation_time;
      changed.push('reservation_time');
    }
    if (input.party_size !== undefined && input.party_size !== r.party_size) {
      patch.party_size = input.party_size;
      changed.push('party_size');
    }
    if ('area_preference' in input && input.area_preference !== undefined) {
      const next = input.area_preference ?? null;
      if (next !== r.area_preference) {
        patch.area_preference = next;
        changed.push('area_preference');
      }
    }
    if ('special_requests' in input && input.special_requests !== undefined) {
      const next = input.special_requests ?? null;
      if (next !== r.special_requests) {
        patch.special_requests = next;
        changed.push('special_requests');
      }
    }

    if (changed.length === 0) {
      return ok<OutputData>({ reservation: r, changed_fields: [] });
    }

    const updated = await tx<ReservationRow[]>`
      UPDATE reservations
      SET ${tx(patch)}, updated_at = now()
      WHERE id = ${r.id}
      RETURNING *
    `;

    return ok<OutputData>({
      reservation: updated[0]!,
      changed_fields: changed,
    });
  },
};
