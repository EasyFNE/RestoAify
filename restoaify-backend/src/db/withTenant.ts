import type { Sql, TxSql } from './sql.js';

/**
 * Run `fn` inside a transaction with `app.current_tenant` set.
 *
 * Every tool handler MUST go through this. The GUC drives all RLS policies;
 * if it's missing, RLS denies everything (`current_setting(..., true)` returns
 * NULL on absence, NULL never equals a tenant_id, so all rows are filtered
 * out). That's the intended fail-safe — but failing safely costs a bug report,
 * so we always set it explicitly.
 *
 * `set_config(name, value, is_local=true)` is equivalent to `SET LOCAL` but
 * usable as an expression, which fits postgres.js's tagged-template style.
 */
export async function withTenant<T>(
  sql: Sql,
  tenantId: string,
  fn: (tx: TxSql) => Promise<T>,
): Promise<T> {
  return await sql.begin(async (tx) => {
    await tx`SELECT set_config('app.current_tenant', ${tenantId}, true)`;
    return await fn(tx);
  }) as T;
}
