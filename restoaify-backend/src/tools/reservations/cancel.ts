import { z } from 'zod';
import { ok } from '../../lib/envelope.js';
import { conflict, notFound } from '../../lib/errors.js';
import { applyTransition } from '../../lib/transitions.js';
import type { ReservationRow } from '../../types/db.js';
import type { ReservationStatus } from '../../types/statuses.js';
import type { ToolDefinition } from '../../types/tools.js';

const InputSchema = z.object({
  reservation_id: z.string().uuid(),
  reason: z.string().min(1).max(500),
  /**
   * 'cancelled' (default) — explicit cancel by customer/staff
   * 'no_show'             — staff-initiated when the party didn't show up
   *                         (only valid from 'confirmed')
   */
  outcome: z.enum(['cancelled', 'no_show']).default('cancelled'),
});

interface OutputData {
  reservation_id: string;
  status: 'cancelled' | 'no_show';
  cancelled_from: ReservationStatus;
  reservation: ReservationRow;
}

const CANCELLABLE_FROM: ReadonlyArray<ReservationStatus> = ['pending', 'confirmed'];

/**
 * Cancel (or mark no_show) a reservation. On successful state change we
 * also free the slot capacity that the reservation was holding.
 *
 * Capacity release:
 *  - We look up the slot by (restaurant_id, date, time). If found, decrement
 *    capacity_reserved by party_size, clamped at 0. The clamp protects us
 *    against historical inconsistencies where a slot's reserved count drifted.
 *  - If no slot row exists (open-capacity restaurant), nothing to do.
 */
export const reservationsCancel: ToolDefinition<typeof InputSchema, OutputData> = {
  code: 'reservations.cancel',
  moduleCode: 'reservations',
  version: 'v1',
  input: InputSchema,
  async handler({ tx, ctx, input }) {
    const rows = await tx<ReservationRow[]>`
      SELECT * FROM reservations WHERE id = ${input.reservation_id} LIMIT 1
    `;
    const r = rows[0];
    if (!r) notFound(`Reservation ${input.reservation_id} not found`);

    if (r.status === input.outcome) {
      // Already in the target terminal state — idempotent success.
      return ok<OutputData>({
        reservation_id: r.id,
        status: input.outcome,
        cancelled_from: input.outcome,
        reservation: r,
      });
    }

    if (input.outcome === 'no_show' && r.status !== 'confirmed') {
      conflict(`no_show is only valid from 'confirmed' (was '${r.status}')`, {
        status: r.status,
      });
    }
    if (input.outcome === 'cancelled' && !CANCELLABLE_FROM.includes(r.status)) {
      conflict(`Cannot cancel a reservation in status '${r.status}'`, {
        status: r.status,
        cancellable_from: CANCELLABLE_FROM,
      });
    }

    await applyTransition(tx, ctx, {
      module: 'reservations',
      table: 'reservations',
      historyTable: 'reservation_status_history',
      fkColumn: 'reservation_id',
      entityId: r.id,
      from: r.status,
      to: input.outcome,
      reason: input.reason,
      historyMetadata: { outcome: input.outcome },
    });

    // Release capacity. We do this AFTER applyTransition succeeds — if the
    // transition is rejected (race on status), capacity stays untouched.
    await tx`
      UPDATE reservation_slots
      SET capacity_reserved = GREATEST(0, capacity_reserved - ${r.party_size}),
          updated_at        = now()
      WHERE restaurant_id = ${r.restaurant_id}
        AND slot_date     = ${r.reservation_date}
        AND slot_time     = ${r.reservation_time}
    `;

    const refreshed = await tx<ReservationRow[]>`
      SELECT * FROM reservations WHERE id = ${r.id} LIMIT 1
    `;
    return ok<OutputData>({
      reservation_id: r.id,
      status: input.outcome,
      cancelled_from: r.status,
      reservation: refreshed[0]!,
    });
  },
};
