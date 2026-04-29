import { z } from 'zod';
import { ok } from '../../lib/envelope.js';
import { notFound } from '../../lib/errors.js';
import type { OrderItemRow, OrderRow } from '../../types/db.js';
import type { OrderStatus } from '../../types/statuses.js';
import type { ToolDefinition } from '../../types/tools.js';

const InputSchema = z.object({
  order_id: z.string().uuid(),
  include_items: z.boolean().default(false),
  include_history: z.boolean().default(false),
});

interface HistoryRow {
  from_status: OrderStatus;
  to_status: OrderStatus;
  actor_type: string;
  actor_id: string | null;
  reason: string | null;
  created_at: string;
}

interface OutputData {
  order_id: string;
  status: OrderStatus;
  order_number: string | null;
  items_count: number;
  subtotal_amount: number;
  total_amount: number;
  currency: string;
  service_type: string;
  requested_for: string | null;
  items?: OrderItemRow[];
  history?: HistoryRow[];
  /** Full row when include_items or include_history is true. */
  order?: OrderRow;
}

/**
 * Read-only status snapshot. Default response is light (~10 scalars) for
 * agent message contexts. Set include_items / include_history for richer
 * UI-side reads.
 *
 * No auth check beyond RLS: if the order belongs to another tenant, the
 * SELECT returns 0 rows and we surface NOT_FOUND.
 */
export const ordersGetStatus: ToolDefinition<typeof InputSchema, OutputData> = {
  code: 'orders.get_status',
  moduleCode: 'orders',
  version: 'v1',
  input: InputSchema,
  async handler({ tx, input }) {
    const rows = await tx<OrderRow[]>`
      SELECT * FROM orders WHERE id = ${input.order_id} LIMIT 1
    `;
    const order = rows[0];
    if (!order) notFound(`Order ${input.order_id} not found`);

    const out: OutputData = {
      order_id: order.id,
      status: order.status,
      order_number: order.order_number,
      items_count: order.items_count,
      subtotal_amount: order.subtotal_amount,
      total_amount: order.total_amount,
      currency: order.currency,
      service_type: order.service_type,
      requested_for: order.requested_for,
    };

    if (input.include_items || input.include_history) {
      out.order = order;
    }

    if (input.include_items) {
      const items = await tx<OrderItemRow[]>`
        SELECT * FROM order_items
        WHERE order_id = ${order.id}
        ORDER BY created_at ASC
      `;
      out.items = items;
    }

    if (input.include_history) {
      const history = await tx<HistoryRow[]>`
        SELECT from_status, to_status, actor_type, actor_id, reason, created_at
        FROM order_status_history
        WHERE order_id = ${order.id}
        ORDER BY created_at ASC
      `;
      out.history = history;
    }

    return ok<OutputData>(out);
  },
};
