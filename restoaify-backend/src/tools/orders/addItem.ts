import { z } from 'zod';
import { ok } from '../../lib/envelope.js';
import { conflict, notFound } from '../../lib/errors.js';
import { recomputeOrderTotals } from '../../lib/orderTotals.js';
import type { OrderItemRow, OrderRow } from '../../types/db.js';
import type { ToolDefinition } from '../../types/tools.js';

const InputSchema = z.object({
  order_id: z.string().uuid(),
  menu_item_id: z.string().uuid(),
  menu_item_variant_id: z.string().uuid().optional(),
  qty: z.number().int().positive().max(100),
  /** Selected option ids — passed through to selected_option_ids[]. */
  option_ids: z.array(z.string().uuid()).max(20).default([]),
  special_instructions: z.string().max(500).optional(),
});

interface OutputData {
  order_item: OrderItemRow;
  order_totals: {
    subtotal_amount: number;
    total_amount: number;
    items_count: number;
  };
}

/**
 * Append an item to a draft order. Variants and free-form options are
 * supported but options pricing is NOT computed in v1 (no menu_item_options
 * table read here): unit_price = base_price + variant.price_delta. Options
 * remain an audit-only field.
 *
 * Pricing snapshot:
 *  - We snapshot menu_item.name and selected options into the row so the
 *    line stays meaningful even if the menu changes later.
 *  - line_total = unit_price * qty (server-computed; never trusted from caller).
 *
 * Restrictions:
 *  - Order must be in 'draft'. Once the customer has been asked for
 *    confirmation, we don't silently mutate the cart.
 *  - menu_item must belong to the same restaurant as the order.
 */
export const ordersAddItem: ToolDefinition<typeof InputSchema, OutputData> = {
  code: 'orders.add_item',
  moduleCode: 'orders',
  version: 'v1',
  input: InputSchema,
  async handler({ tx, ctx, input }) {
    const orderRows = await tx<OrderRow[]>`
      SELECT * FROM orders WHERE id = ${input.order_id} LIMIT 1
    `;
    const order = orderRows[0];
    if (!order) notFound(`Order ${input.order_id} not found`);
    if (order.status !== 'draft') {
      conflict(
        `Cannot add items to an order in status '${order.status}'`,
        { status: order.status, allowed: ['draft'] },
      );
    }

    // Resolve menu item + variant. Pricing is computed here, server-side.
    const menuRows = await tx<
      Array<{
        id: string;
        restaurant_id: string | null;
        name: string;
        base_price: number;
        currency: string;
        status: string;
      }>
    >`
      SELECT id, restaurant_id, name, base_price, currency, status
      FROM menu_items
      WHERE id = ${input.menu_item_id}
      LIMIT 1
    `;
    const menuItem = menuRows[0];
    if (!menuItem) notFound(`Menu item ${input.menu_item_id} not found`);
    if (menuItem.status !== 'active') {
      conflict(`Menu item is ${menuItem.status}`, { status: menuItem.status });
    }
    if (menuItem.restaurant_id !== null && menuItem.restaurant_id !== order.restaurant_id) {
      conflict('Menu item does not belong to the order\'s restaurant', {
        order_restaurant_id: order.restaurant_id,
        menu_item_restaurant_id: menuItem.restaurant_id,
      });
    }
    if (menuItem.currency !== order.currency) {
      conflict('Menu item currency mismatch with order', {
        order_currency: order.currency,
        menu_item_currency: menuItem.currency,
      });
    }

    let priceDelta = 0;
    let variantName: string | null = null;
    if (input.menu_item_variant_id) {
      const variantRows = await tx<
        Array<{ id: string; menu_item_id: string; name: string; price_delta: number; status: string }>
      >`
        SELECT id, menu_item_id, name, price_delta, status
        FROM menu_item_variants
        WHERE id = ${input.menu_item_variant_id}
        LIMIT 1
      `;
      const variant = variantRows[0];
      if (!variant) notFound(`Variant ${input.menu_item_variant_id} not found`);
      if (variant.menu_item_id !== input.menu_item_id) {
        conflict('Variant does not belong to the given menu item');
      }
      if (variant.status !== 'active') {
        conflict(`Variant is ${variant.status}`);
      }
      priceDelta = variant.price_delta;
      variantName = variant.name;
    }

    const unitPrice = Math.max(0, menuItem.base_price + priceDelta);
    const lineTotal = unitPrice * input.qty;
    const nameSnapshot = variantName ? `${menuItem.name} — ${variantName}` : menuItem.name;
    // Cast to never satisfies postgres.js's strict JSONValue type when no
    // custom serializers are configured.
    const optionsSnapshot = { option_ids: input.option_ids } as never;

    const inserted = await tx<OrderItemRow[]>`
      INSERT INTO order_items (
        tenant_id, order_id, menu_item_id, menu_item_variant_id,
        qty, unit_price, total_price, line_total,
        selected_option_ids, special_instructions,
        item_name_snapshot, selected_options_snapshot
      ) VALUES (
        ${ctx.tenantId}, ${order.id},
        ${input.menu_item_id}, ${input.menu_item_variant_id ?? null},
        ${input.qty}, ${unitPrice}, ${lineTotal}, ${lineTotal},
        ${input.option_ids as unknown as string[]},
        ${input.special_instructions ?? null},
        ${nameSnapshot}, ${tx.json(optionsSnapshot)}
      )
      RETURNING *
    `;
    const orderItem = inserted[0]!;

    const totals = await recomputeOrderTotals(tx, order.id);

    return ok<OutputData>({ order_item: orderItem, order_totals: totals });
  },
};
