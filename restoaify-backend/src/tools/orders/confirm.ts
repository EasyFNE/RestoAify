import { z } from 'zod';
import { ok } from '../../lib/envelope.js';
import { conflict, notFound } from '../../lib/errors.js';
import { applyTransition } from '../../lib/transitions.js';
import type { OrderRow } from '../../types/db.js';
import type { ToolDefinition } from '../../types/tools.js';

const InputSchema = z.object({
  order_id: z.string().uuid(),
  /** If set, allows skipping `awaiting_confirmation` (rare; for back-office). */
  from_status: z.enum(['draft', 'awaiting_confirmation']).optional(),
  reason: z.string().max(500).optional(),
});

interface OutputData {
  order_id: string;
  status: 'confirmed';
  order: OrderRow;
}

/**
 * Move an order to 'confirmed'. Allowed from 'draft' (direct confirm) or
 * 'awaiting_confirmation' (after explicit user OK in the conversation).
 *
 * Pre-conditions:
 *  - Order exists in this tenant.
 *  - At least one order_item (no empty confirmed orders).
 *  - subtotal_amount > 0 (sanity check on pricing path).
 *
 * The transition itself is delegated to applyTransition which:
 *  - validates (from → confirmed) is allowed,
 *  - performs the optimistic UPDATE (with `WHERE status = from` race guard),
 *  - inserts the order_status_history row.
 */
export const ordersConfirm: ToolDefinition<typeof InputSchema, OutputData> = {
  code: 'orders.confirm',
  moduleCode: 'orders',
  version: 'v1',
  input: InputSchema,
  async handler({ tx, ctx, input }) {
    const rows = await tx<Array<OrderRow>>`
      SELECT * FROM orders WHERE id = ${input.order_id} LIMIT 1
    `;
    const order = rows[0];
    if (!order) notFound(`Order ${input.order_id} not found`);

    // Sanity: a confirmable order has at least one item with non-zero subtotal.
    if (order.items_count <= 0 || order.subtotal_amount <= 0) {
      conflict(
        'Order is empty or has zero subtotal — add items before confirming',
        { items_count: order.items_count, subtotal_amount: order.subtotal_amount },
      );
    }

    const fromStatus = input.from_status ?? order.status;
    if (fromStatus !== order.status) {
      conflict(
        `from_status mismatch: order is in '${order.status}', not '${fromStatus}'`,
        { actual: order.status, expected: fromStatus },
      );
    }
    if (order.status === 'confirmed') {
      // Already confirmed — idempotent success (replay-friendly).
      return ok<OutputData>({
        order_id: order.id,
        status: 'confirmed',
        order,
      });
    }

    await applyTransition(tx, ctx, {
      module: 'orders',
      table: 'orders',
      historyTable: 'order_status_history',
      fkColumn: 'order_id',
      entityId: order.id,
      from: order.status,
      to: 'confirmed',
      reason: input.reason ?? undefined,
    });

    const refreshed = await tx<Array<OrderRow>>`
      SELECT * FROM orders WHERE id = ${order.id} LIMIT 1
    `;
    return ok<OutputData>({
      order_id: order.id,
      status: 'confirmed',
      order: refreshed[0]!,
    });
  },
};
