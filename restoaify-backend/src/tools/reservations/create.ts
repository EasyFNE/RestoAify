import { z } from 'zod';
import { fail, ok } from '../../lib/envelope.js';
import { notFound } from '../../lib/errors.js';
import type { ReservationRow } from '../../types/db.js';
import type { ToolDefinition } from '../../types/tools.js';

const InputSchema = z.object({
  restaurant_id: z.string().uuid(),
  contact_id: z.string().uuid(),
  conversation_id: z.string().uuid().optional(),
  reservation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  reservation_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'HH:MM[:SS]'),
  party_size: z.number().int().positive().max(50),
  area_preference: z.string().max(100).optional(),
  special_requests: z.string().max(1000).optional(),
  /** Auto-generated if omitted: RES-YYYYMMDD-{random6}. */
  reservation_number: z.string().min(3).max(64).optional(),
});

interface OutputData {
  reservation_id: string;
  reservation_number: string;
  status: 'pending';
  reservation: ReservationRow;
}

function generateReservationNumber(date: string): string {
  const compact = date.replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `RES-${compact}-${rand}`;
}

/**
 * Create a reservation in 'pending'. The slot capacity check is best-effort:
 * we look up the matching reservation_slots row and refuse if at capacity.
 * If no slot row exists for that (restaurant, date, time), we accept the
 * request without capacity gating — restaurants that don't manage slots
 * should be allowed to operate.
 *
 * For confirmed availability semantics, prefer reservations.check_availability
 * before this tool.
 */
export const reservationsCreate: ToolDefinition<typeof InputSchema, OutputData> = {
  code: 'reservations.create',
  moduleCode: 'reservations',
  version: 'v1',
  input: InputSchema,
  async handler({ tx, ctx, input }) {
    const restaurant = await tx<Array<{ id: string; status: string }>>`
      SELECT id, status FROM restaurants WHERE id = ${input.restaurant_id} LIMIT 1
    `;
    if (!restaurant[0]) notFound(`Restaurant ${input.restaurant_id} not found`);

    const contact = await tx<Array<{ id: string }>>`
      SELECT id FROM contacts WHERE id = ${input.contact_id} LIMIT 1
    `;
    if (!contact[0]) notFound(`Contact ${input.contact_id} not found`);

    // Best-effort slot capacity check.
    const slot = await tx<
      Array<{
        id: string;
        capacity_total: number;
        capacity_reserved: number;
        status: string;
      }>
    >`
      SELECT id, capacity_total, capacity_reserved, status
      FROM reservation_slots
      WHERE restaurant_id = ${input.restaurant_id}
        AND slot_date     = ${input.reservation_date}
        AND slot_time     = ${input.reservation_time}
      LIMIT 1
    `;
    if (slot[0]) {
      if (slot[0].status !== 'open') {
        // Business non-success: surface as success=false but with a meaningful
        // code so the agent can reply appropriately.
        return fail<OutputData>(
          'CONFLICT',
          `Slot ${input.reservation_date} ${input.reservation_time} is ${slot[0].status}`,
          { slot_status: slot[0].status },
        );
      }
      if (slot[0].capacity_reserved + input.party_size > slot[0].capacity_total) {
        return fail<OutputData>(
          'CONFLICT',
          'Slot does not have enough remaining capacity',
          {
            party_size: input.party_size,
            available:
              slot[0].capacity_total - slot[0].capacity_reserved,
          },
        );
      }
    }

    const reservationNumber =
      input.reservation_number ?? generateReservationNumber(input.reservation_date);

    const inserted = await tx<Array<ReservationRow>>`
      INSERT INTO reservations (
        tenant_id, restaurant_id, contact_id, conversation_id,
        reservation_number, reservation_date, reservation_time,
        party_size, status, area_preference, special_requests
      )
      VALUES (
        ${ctx.tenantId}, ${input.restaurant_id}, ${input.contact_id},
        ${input.conversation_id ?? null},
        ${reservationNumber}, ${input.reservation_date}, ${input.reservation_time},
        ${input.party_size}, 'pending',
        ${input.area_preference ?? null}, ${input.special_requests ?? null}
      )
      ON CONFLICT (tenant_id, reservation_number) DO NOTHING
      RETURNING *
    `;

    let reservation: ReservationRow;
    if (inserted[0]) {
      reservation = inserted[0];
      // Bump the slot's reserved capacity, if a slot row exists.
      if (slot[0]) {
        await tx`
          UPDATE reservation_slots
          SET capacity_reserved = capacity_reserved + ${input.party_size},
              updated_at = now()
          WHERE id = ${slot[0].id}
        `;
      }
    } else {
      // The reservation_number collided. Most likely cause: caller passed an
      // explicit number that already exists. Re-fetch the existing row so the
      // tool stays idempotent.
      const existing = await tx<Array<ReservationRow>>`
        SELECT * FROM reservations
        WHERE reservation_number = ${reservationNumber}
        LIMIT 1
      `;
      if (!existing[0]) {
        throw new Error('reservations.create: ON CONFLICT but no existing row');
      }
      reservation = existing[0];
    }

    return ok<OutputData>({
      reservation_id: reservation.id,
      reservation_number: reservation.reservation_number,
      status: 'pending',
      reservation,
    });
  },
};
