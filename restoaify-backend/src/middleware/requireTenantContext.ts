import type { MiddlewareHandler } from 'hono';
import { sql } from '../db/sql.js';

/**
 * Resolves the tenant context for the request and verifies that the
 * authenticated user actually belongs to that tenant.
 *
 * Tenant id resolution order:
 *   1. `X-Tenant-Id` header (explicit, used by frontends with a tenant switcher)
 *   2. JWT custom claim `app_metadata.tenant_id` (single-tenant SSO)
 *
 * Authorization check: the user must have an active row in tenant_users
 * for the requested tenant. We do NOT trust the frontend to prove this; we
 * query the DB. This query runs WITHOUT RLS context (we're discovering the
 * tenant), so we need to be precise about the predicate.
 *
 * The downstream handler runs through wrapTool, which opens a transaction,
 * calls SET LOCAL app.current_tenant, and engages RLS. So the only "RLS-free"
 * read is this one membership check.
 */

declare module 'hono' {
  interface ContextVariableMap {
    tenantId: string;
  }
}

export const requireTenantContext: MiddlewareHandler = async (c, next) => {
  const auth = c.get('auth');
  if (!auth) {
    return c.json(
      { success: false, errors: [{ code: 'PERMISSION_DENIED', message: 'requireAuth must run first' }] },
      500,
    );
  }

  const headerTenant = c.req.header('x-tenant-id')?.trim();
  const tenantId = headerTenant; // JWT-claim path can be added later

  if (!tenantId) {
    return c.json(
      { success: false, errors: [{ code: 'VALIDATION_ERROR', message: 'X-Tenant-Id header is required' }] },
      400,
    );
  }
  // Cheap UUID shape check — proper validation happens in DB.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
    return c.json(
      { success: false, errors: [{ code: 'VALIDATION_ERROR', message: 'X-Tenant-Id is not a valid UUID' }] },
      400,
    );
  }

  // Verify membership. tenant_users is RLS-protected, so we open a tiny
  // transaction with `app.current_tenant` set to the *claimed* tenantId.
  //   - If the user really belongs to that tenant, the row is visible.
  //   - If not, RLS hides everything → 0 rows → 403.
  // This is safe: claiming a tenantId you don't belong to never reveals
  // anything beyond "you're not a member here".
  const rows = await sql.begin(async (tx) => {
    await tx`SELECT set_config('app.current_tenant', ${tenantId}, true)`;
    return tx<Array<{ status: string }>>`
      SELECT status
      FROM tenant_users
      WHERE tenant_id = ${tenantId}
        AND user_id   = ${auth.sub}
      LIMIT 1
    `;
  });
  const membership = (rows as Array<{ status: string }>)[0];
  if (!membership || membership.status !== 'active') {
    return c.json(
      {
        success: false,
        errors: [{ code: 'PERMISSION_DENIED', message: 'User has no active membership in this tenant' }],
      },
      403,
    );
  }

  c.set('tenantId', tenantId);
  await next();
};
