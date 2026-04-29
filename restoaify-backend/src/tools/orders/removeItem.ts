import { z } from 'zod';
import { ok } from '../../lib/envelope.js';
import { conflict, notFound } from '../../lib/errors.js';
import { recomputeOrderTotals } from '../../lib/orderTotals.js';
import type { OrderRow } from '../../types/db.js';
import type { ToolDefinition } from '../../types/tools.js';

const InputSchema = z.object({
  order_id: z.string().uuid(),
  order_item_id: z.string().uuid(),
});

interface OutputData {
  removed_item_id: string;
  order_totals: {
    subtotal_amount: number;
    total_amount: number;
    items_count: number;
  };
}

/**
 * Remove a single line from a draft order. Same status restriction as
 * add_item: only 'draft' is mutable.
 *
 * Idempotency note: a replay of the same call returns the cached envelope
 * via tool_executions — but if the wrapTool cache is bypassed, the second
 * call would hit a `not found` because the row is gone. That's the correct
 * behaviour: the agent should treat NOT_FOUND on remove as "already gone,
 * carry on", which is what the cached replay does anyway.
 */
export const ordersRemoveItem: ToolDefinition<typeof InputSchema, OutputData> = {
  code: 'orders.remove_item',
  moduleCode: 'orders',
  version: 'v1',
  input: InputSchema,
  async handler({ tx, input }) {
    const orderRows = await tx<OrderRow[]>`
      SELECT * FROM orders WHERE id = ${input.order_id} LIMIT 1
    `;
    const order = orderRows[0];
    if (!order) notFound(`Order ${input.order_id} not found`);
    if (order.status !== 'draft') {
      conflict(
        `Cannot remove items from an order in status '${order.status}'`,
        { status: order.status, allowed: ['draft'] },
      );
    }

    const deleted = await tx<Array<{ id: string }>>`
      DELETE FROM order_items
      WHERE id       = ${input.order_item_id}
        AND order_id = ${input.order_id}
      RETURNING id
    `;
    if (!deleted[0]) {
      notFound(`Order item ${input.order_item_id} not found on order ${input.order_id}`);
    }

    const totals = await recomputeOrderTotals(tx, order.id);

    return ok<OutputData>({
      removed_item_id: input.order_item_id,
      order_totals: totals,
    });
  },
};
