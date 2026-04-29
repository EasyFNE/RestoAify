import postgres from 'postgres';
import { env } from '../config/env.js';

/**
 * Single postgres.js client for the backend.
 *
 * Why postgres.js (not @supabase/supabase-js):
 *  - We need real transactions with `SET LOCAL app.current_tenant = ...`
 *    so that RLS policies on tenant-scoped tables enforce isolation.
 *  - PostgREST (which supabase-js wraps) does not give us a per-request
 *    transaction-bound connection.
 *
 * Why port 6543 (transaction pooler) is mandatory:
 *  - `SET LOCAL` only lasts for the lifetime of a transaction.
 *  - In transaction-pooling mode, each `BEGIN ... COMMIT` cycle obtains its
 *    own backend connection, so the tenant context cannot leak across requests.
 *  - The check in config/env.ts enforces this.
 *
 * Prepared statements are disabled because PgBouncer transaction mode does
 * not support them across pool checkouts.
 */
export const sql = postgres(env.DATABASE_URL, {
  prepare: false,
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
  types: {},
});

export type Sql = postgres.Sql<Record<string, never>>;
export type TxSql = postgres.TransactionSql<Record<string, never>>;
