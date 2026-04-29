import type { TxSql } from '../db/sql.js';
import type { ToolContext } from '../types/context.js';
import type {
  CateringStatus,
  HealthyStatus,
  ModuleCode,
  OrderStatus,
  ReservationStatus,
} from '../types/statuses.js';
import {
  CATERING_TRANSITIONS,
  HEALTHY_TRANSITIONS,
  ORDER_TRANSITIONS,
  RESERVATION_TRANSITIONS,
} from '../types/statuses.js';
import { conflict } from './errors.js';

type ModuleStatusMap = {
  orders: OrderStatus;
  reservations: ReservationStatus;
  catering: CateringStatus;
  healthy: HealthyStatus;
};

type TransitionsFor<M extends keyof ModuleStatusMap> = ReadonlyArray<
  readonly [ModuleStatusMap[M], ModuleStatusMap[M]]
>;

const TRANSITIONS = {
  orders: ORDER_TRANSITIONS,
  reservations: RESERVATION_TRANSITIONS,
  catering: CATERING_TRANSITIONS,
  healthy: HEALTHY_TRANSITIONS,
} satisfies { [M in keyof ModuleStatusMap]: TransitionsFor<M> };

/**
 * Throws ToolError(CONFLICT) if (from → to) is not in the allowed list for
 * the module. The list is the source of truth — see 06-lifecycle-status.md.
 */
export function validateTransition<M extends keyof ModuleStatusMap>(
  module: M,
  from: ModuleStatusMap[M],
  to: ModuleStatusMap[M],
): void {
  const allowed = TRANSITIONS[module] as ReadonlyArray<readonly [string, string]>;
  if (from === to) {
    conflict(`No-op transition: ${module} is already in '${from}'`, { from, to });
  }
  const ok = allowed.some(([f, t]) => f === from && t === to);
  if (!ok) {
    conflict(
      `Illegal ${module} transition '${from}' → '${to}'`,
      { from, to, module },
    );
  }
}

/**
 * Apply a validated transition: UPDATE the parent row, INSERT the history row.
 *
 * Important: orders.order_status_history has NO `metadata` column (per the
 * arbitration in 011/012 audit). For orders, callers should put structured
 * context into the audit_log instead — that's where it belongs anyway.
 */
export async function applyTransition<M extends keyof ModuleStatusMap>(
  tx: TxSql,
  ctx: ToolContext,
  args: {
    module: M;
    table: 'orders' | 'reservations' | 'catering_requests' | 'healthy_subscriptions';
    historyTable:
      | 'order_status_history'
      | 'reservation_status_history'
      | 'catering_status_history'
      | 'healthy_status_history';
    fkColumn: 'order_id' | 'reservation_id' | 'catering_request_id' | 'subscription_id';
    entityId: string;
    from: ModuleStatusMap[M];
    to: ModuleStatusMap[M];
    reason?: string | undefined;
    historyMetadata?: Record<string, unknown> | undefined; // ignored for orders
  },
): Promise<void> {
  validateTransition(args.module, args.from, args.to);

  // 1. Optimistic UPDATE on the parent. The WHERE clause includes the prior
  //    status to prevent racing transitions.
  const updated = await tx<Array<{ id: string }>>`
    UPDATE ${tx(args.table)}
    SET    status = ${args.to}, updated_at = now()
    WHERE  id = ${args.entityId}
      AND  status = ${args.from}
    RETURNING id
  `;
  if (updated.length === 0) {
    conflict(
      `Concurrent update on ${args.table}: expected status '${args.from}'`,
      { entityId: args.entityId, expected: args.from, target: args.to },
    );
  }

  // 2. Insert the history row. Branch on whether the table has metadata.
  if (args.historyTable === 'order_status_history') {
    await tx`
      INSERT INTO order_status_history (
        tenant_id, order_id, from_status, to_status, actor_type, actor_id, reason
      ) VALUES (
        ${ctx.tenantId}, ${args.entityId},
        ${args.from}, ${args.to},
        ${ctx.actor.type}, ${ctx.actor.id},
        ${args.reason ?? null}
      )
    `;
  } else {
    await tx`
      INSERT INTO ${tx(args.historyTable)} (
        tenant_id, ${tx(args.fkColumn)}, from_status, to_status,
        actor_type, actor_id, reason, metadata
      ) VALUES (
        ${ctx.tenantId}, ${args.entityId},
        ${args.from}, ${args.to},
        ${ctx.actor.type}, ${ctx.actor.id},
        ${args.reason ?? null},
        ${args.historyMetadata ? tx.json(args.historyMetadata as never) : null}
      )
    `;
  }
}

export type { ModuleCode };
