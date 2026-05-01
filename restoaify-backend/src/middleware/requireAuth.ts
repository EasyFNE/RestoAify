import type { MiddlewareHandler } from 'hono';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from '../config/env.js';

/**
 * Verifies a Supabase Auth JWT (HS256 or ES256) and attaches the claims to
 * the request context.
 *
 * New Supabase projects emit ES256 tokens signed with an asymmetric key pair.
 * We use the JWKS endpoint exposed by Supabase Auth so the public key is
 * fetched automatically and cached — no round-trip per request after the
 * first fetch.
 *
 * Legacy projects still using HS256 are supported via fallback to the
 * symmetric secret.
 *
 * Supabase JWTs include:
 *   - sub: user UUID
 *   - email
 *   - role: 'authenticated' | 'anon' | 'service_role'
 *   - aud: 'authenticated'
 *
 * service_role tokens are rejected — they bypass RLS and must never reach
 * this middleware.
 */

// JWKS endpoint is derived from the issuer embedded in the token.
// Format: https://<project>.supabase.co/auth/v1 → /.well-known/jwks.json
const SUPABASE_URL = env.SUPABASE_JWT_SECRET
  ? (() => {
      // Extract project ref from the JWT secret is not possible.
      // We derive the URL from SUPABASE_URL env var instead.
      return (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
    })()
  : '';

const JWKS = SUPABASE_URL
  ? createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`))
  : null;

const HS256_SECRET = new TextEncoder().encode(env.SUPABASE_JWT_SECRET);

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

  // Detect algorithm from JWT header (no verification yet)
  let alg = 'HS256';
  try {
    const headerJson = JSON.parse(
      Buffer.from(token.split('.')[0], 'base64url').toString('utf8'),
    );
    alg = headerJson.alg ?? 'HS256';
  } catch {
    // malformed token — will fail verification below
  }

  try {
    let payload: Record<string, unknown>;

    if (alg === 'ES256' && JWKS) {
      // Asymmetric: verify via JWKS (public key fetched from Supabase)
      const result = await jwtVerify(token, JWKS, { algorithms: ['ES256'] });
      payload = result.payload as Record<string, unknown>;
    } else {
      // Symmetric fallback: HS256
      const result = await jwtVerify(token, HS256_SECRET, { algorithms: ['HS256'] });
      payload = result.payload as Record<string, unknown>;
    }

    if (typeof payload.sub !== 'string') {
      return c.json(
        { success: false, errors: [{ code: 'PERMISSION_DENIED', message: 'Invalid token: no sub' }] },
        401,
      );
    }
    if (payload.role === 'service_role') {
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
