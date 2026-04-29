import { z } from 'zod';
import { ok } from '../../lib/envelope.js';
import { notFound } from '../../lib/errors.js';
import type { ToolDefinition } from '../../types/tools.js';

const InputSchema = z.object({
  restaurant_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  party_size: z.number().int().positive().max(50),
  /**
   * Optional time window filter (HH:MM[:SS]). When omitted, returns all
   * eligible slots for the day.
   */
  earliest_time: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'HH:MM[:SS]')
    .optional(),
  latest_time: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'HH:MM[:SS]')
    .optional(),
});

interface AvailableSlot {
  slot_time: string;          // HH:MM:SS
  capacity_total: number;
  capacity_remaining: number;
  status: 'open';
}

interface OutputData {
  restaurant_id: string;
  date: string;
  party_size: number;
  /**
   * 'managed_slots'   — restaurant configures reservation_slots; we filter them.
   * 'open_capacity'   — no slot rows at all for this date; restaurant operates
   *                     without slot gating. Caller decides what to do (often:
   *                     accept the reservation request as-is).
   */
  mode: 'managed_slots' | 'open_capacity';
  available_slots: AvailableSlot[];
}

/**
 * Read-only availability lookup. Never mutates capacity (that happens in
 * reservations.create / .update / .cancel).
 *
 * Why no "default opening hours" fallback:
 *  - Inventing slots from a hardcoded grid would silently disagree with what
 *    the restaurant actually wants. Better to be explicit: if there are no
 *    slots, say so via mode='open_capacity' and let the caller proceed with
 *    a request that can be confirmed by staff.
 */
export const reservationsCheckAvailability: ToolDefinition<typeof InputSchema, OutputData> = {
  code: 'reservations.check_availability',
  moduleCode: 'reservations',
  version: 'v1',
  input: InputSchema,
  async handler({ tx, input }) {
    // Verify restaurant exists in this tenant (RLS would already hide it).
    const restaurant = await tx<Array<{ id: string; status: string }>>`
      SELECT id, status FROM restaurants WHERE id = ${input.restaurant_id} LIMIT 1
    `;
    if (!restaurant[0]) notFound(`Restaurant ${input.restaurant_id} not found`);

    // Single SELECT — let Postgres do the filtering. We deliberately use
    // boolean flags as parameters rather than dynamic SQL: the planner caches
    // the plan once and parameter binding is safe.
    const hasEarliest = input.earliest_time !== undefined;
    const hasLatest = input.latest_time !== undefined;

    const slots = await tx<
      Array<{
        slot_time: string;
        capacity_total: number;
        capacity_reserved: number;
        status: string;
      }>
    >`
      SELECT slot_time, capacity_total, capacity_reserved, status
      FROM reservation_slots
      WHERE restaurant_id = ${input.restaurant_id}
        AND slot_date     = ${input.date}
        AND status        = 'open'
        AND (${!hasEarliest} OR slot_time >= ${input.earliest_time ?? '00:00'})
        AND (${!hasLatest}   OR slot_time <= ${input.latest_time   ?? '23:59'})
        AND (capacity_total - capacity_reserved) >= ${input.party_size}
      ORDER BY slot_time ASC
    `;

    // Distinguish "filtered out" from "no slots configured". The cheapest
    // way is a second tiny query with COUNT(*); cheaper than fetching all
    // slots and post-filtering in JS.
    let mode: OutputData['mode'] = 'managed_slots';
    if (slots.length === 0) {
      const anyRows = await tx<Array<{ count: string }>>`
        SELECT COUNT(*) AS count
        FROM reservation_slots
        WHERE restaurant_id = ${input.restaurant_id}
          AND slot_date     = ${input.date}
      `;
      if (Number(anyRows[0]?.count ?? 0) === 0) {
        mode = 'open_capacity';
      }
    }

    return ok<OutputData>({
      restaurant_id: input.restaurant_id,
      date: input.date,
      party_size: input.party_size,
      mode,
      available_slots: slots.map((s) => ({
        slot_time: s.slot_time,
        capacity_total: s.capacity_total,
        capacity_remaining: s.capacity_total - s.capacity_reserved,
        status: 'open' as const,
      })),
    });
  },
};
