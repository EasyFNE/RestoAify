import type { TxSql } from '../db/sql.js';

/**
 * Recompute and persist subtotal_amount, total_amount, items_count on an
 * order from the sum of its order_items.
 *
 * Why a helper instead of triggers:
 *  - We want the totals computed in the SAME transaction as the item
 *    insert/delete, so the parent row is consistent before commit.
 *  - Using a SQL trigger would also work but spreads the rule across DB
 *    and app code; for v1 the explicit helper is clearer.
 *
 * Total vs subtotal:
 *  - The DB has both columns. Tax / delivery fees are not modelled in the
 *    current schema, so total_amount = subtotal_amount for now. When that
 *    changes, this is the single place to update.
 *
 * Returns the recomputed totals so callers can put them in the envelope.
 */
export async function recomputeOrderTotals(
  tx: TxSql,
  orderId: string,
): Promise<{ subtotal_amount: number; total_amount: number; items_count: number }> {
  const rows = await tx<
    Array<{ subtotal: string | null; count: string }>
  >`
    SELECT COALESCE(SUM(line_total), 0) AS subtotal,
           COUNT(*)                     AS count
    FROM order_items
    WHERE order_id = ${orderId}
  `;
  const r = rows[0]!;
  const subtotal = Number(r.subtotal ?? 0);
  const itemsCount = Number(r.count);
  const total = subtotal; // see Total vs subtotal note above

  await tx`
    UPDATE orders
    SET subtotal_amount = ${subtotal},
        total_amount    = ${total},
        items_count     = ${itemsCount},
        updated_at      = now()
    WHERE id = ${orderId}
  `;

  return {
    subtotal_amount: subtotal,
    total_amount: total,
    items_count: itemsCount,
  };
}
