import type { MiddlewareHandler } from 'hono';
import { jwtVerify } from 'jose';
import { env } from '../config/env.js';

/**
 * Verifies a Supabase Auth JWT (HS256) and attaches the claims to the
 * request context. We deliberately do NOT use @supabase/supabase-js's
 * `auth.getUser(token)` because it makes an HTTP round-trip per request;
 * local verification with the JWT secret is sub-millisecond and stateless.
 *
 * Supabase JWTs include:
 *   - sub: user UUID
 *   - email
 *   - role: 'authenticated' | 'anon' | 'service_role'
 *   - aud: 'authenticated'
 *
 * Anything calling `service_role` here is a bug — service_role bypasses RLS
 * and should never reach this middleware (n8n / agents authenticate via a
 * separate path, not implemented in this delivery).
 */

const SECRET = new TextEncoder().encode(env.SUPABASE_JWT_SECRET);

export interface AuthClaims {
  sub: string;
  email?: string | undefined;
  role: string;
}

declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthClaims;
  }
}

export const requireAuth: MiddlewareHandler = async (c, next) => {
  const header = c.req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    return c.json(
      { success: false, errors: [{ code: 'PERMISSION_DENIED', message: 'Missing bearer token' }] },
      401,
    );
  }
  const token = header.slice('Bearer '.length).trim();

  try {
    const { payload } = await jwtVerify(token, SECRET, { algorithms: ['HS256'] });
    if (typeof payload.sub !== 'string') {
      return c.json(
        { success: false, errors: [{ code: 'PERMISSION_DENIED', message: 'Invalid token: no sub' }] },
        401,
      );
    }
    if (payload.role === 'service_role') {
      // Service role is for internal admin only and bypasses RLS.
      // It MUST NOT be used from the browser-facing API.
      return c.json(
        { success: false, errors: [{ code: 'PERMISSION_DENIED', message: 'Service role tokens are not accepted' }] },
        403,
      );
    }
    c.set('auth', {
      sub: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      role: typeof payload.role === 'string' ? payload.role : 'authenticated',
    });
    await next();
  } catch {
    return c.json(
      { success: false, errors: [{ code: 'PERMISSION_DENIED', message: 'Invalid or expired token' }] },
      401,
    );
  }
};
