import { z } from 'zod';
import { ok } from '../../lib/envelope.js';
import { conflict, notFound } from '../../lib/errors.js';
import { applyTransition } from '../../lib/transitions.js';
import type { OrderRow } from '../../types/db.js';
import type { OrderStatus } from '../../types/statuses.js';
import type { ToolDefinition } from '../../types/tools.js';

const InputSchema = z.object({
  order_id: z.string().uuid(),
  reason: z.string().min(1).max(500),
});

interface OutputData {
  order_id: string;
  status: 'cancelled';
  cancelled_from: OrderStatus;
  order: OrderRow;
}

const CANCELLABLE_FROM: ReadonlyArray<OrderStatus> = [
  'draft',
  'awaiting_confirmation',
  'confirmed',
  'in_preparation',
];

/**
 * Cancel an order. Allowed from any pre-`ready` state.
 * Reason is mandatory — no anonymous cancels in audit.
 */
export const ordersCancel: ToolDefinition<typeof InputSchema, OutputData> = {
  code: 'orders.cancel',
  moduleCode: 'orders',
  version: 'v1',
  input: InputSchema,
  async handler({ tx, ctx, input }) {
    const rows = await tx<Array<OrderRow>>`
      SELECT * FROM orders WHERE id = ${input.order_id} LIMIT 1
    `;
    const order = rows[0];
    if (!order) notFound(`Order ${input.order_id} not found`);

    if (order.status === 'cancelled') {
      // Idempotent: already cancelled.
      return ok<OutputData>({
        order_id: order.id,
        status: 'cancelled',
        cancelled_from: 'cancelled',
        order,
      });
    }
    if (!CANCELLABLE_FROM.includes(order.status)) {
      conflict(
        `Cannot cancel an order in status '${order.status}'`,
        { status: order.status, cancellable_from: CANCELLABLE_FROM },
      );
    }

    await applyTransition(tx, ctx, {
      module: 'orders',
      table: 'orders',
      historyTable: 'order_status_history',
      fkColumn: 'order_id',
      entityId: order.id,
      from: order.status,
      to: 'cancelled',
      reason: input.reason,
    });

    const refreshed = await tx<Array<OrderRow>>`
      SELECT * FROM orders WHERE id = ${order.id} LIMIT 1
    `;
    return ok<OutputData>({
      order_id: order.id,
      status: 'cancelled',
      cancelled_from: order.status,
      order: refreshed[0]!,
    });
  },
};
