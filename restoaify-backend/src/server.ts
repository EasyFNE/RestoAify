import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { z } from 'zod';
import { env } from './config/env.js';
import { sql } from './db/sql.js';
import { executeTool } from './lib/wrapTool.js';
import { requireAuth } from './middleware/requireAuth.js';
import { requireTenantContext } from './middleware/requireTenantContext.js';
import { getTool, listToolCodes } from './tools/registry.js';

const app = new Hono();

app.use('*', logger());
if (env.CORS_ORIGINS.length > 0) {
  app.use(
    '*',
    cors({
      origin: env.CORS_ORIGINS,
      allowHeaders: ['Authorization', 'Content-Type', 'X-Tenant-Id', 'X-Correlation-Id'],
      allowMethods: ['GET', 'POST', 'OPTIONS'],
    }),
  );
}

// ── Public ──────────────────────────────────────────────────────────────────
app.get('/health', async (c) => {
  try {
    const r = await sql<Array<{ ok: number }>>`SELECT 1 AS ok`;
    return c.json({ status: 'ok', db: r[0]?.ok === 1 });
  } catch {
    return c.json({ status: 'degraded', db: false }, 503);
  }
});

app.get('/tools', requireAuth, requireTenantContext, (c) => {
  return c.json({ tools: listToolCodes() });
});

// ── Tool execution endpoint ────────────────────────────────────────────────
const ExecuteSchema = z.object({
  tool_code: z.string().min(1),
  correlation_id: z.string().min(8).max(128),
  conversation_id: z.string().uuid().optional(),
  contact_id: z.string().uuid().optional(),
  restaurant_id: z.string().uuid().optional(),
  actor: z
    .object({
      type: z.enum(['user', 'agent', 'system']),
      id: z.string().nullable(),
    })
    .optional(),
  input: z.unknown(),
});

app.post('/tools/execute', requireAuth, requireTenantContext, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = ExecuteSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        status: 'error',
        data: null,
        warnings: [],
        errors: [
          {
            code: 'VALIDATION_ERROR',
            message: 'Request body failed validation',
            details: parsed.error.flatten(),
          },
        ],
        timestamp: new Date().toISOString(),
      },
      400,
    );
  }
  const req = parsed.data;
  const tool = getTool(req.tool_code);
  if (!tool) {
    return c.json(
      {
        success: false,
        status: 'error',
        data: null,
        warnings: [],
        errors: [{ code: 'NOT_FOUND', message: `Unknown tool: ${req.tool_code}` }],
        timestamp: new Date().toISOString(),
      },
      404,
    );
  }

  const auth = c.get('auth');
  const tenantId = c.get('tenantId');
  const envelope = await executeTool(
    {
      tenantId,
      restaurantId: req.restaurant_id,
      conversationId: req.conversation_id,
      contactId: req.contact_id,
      actor: req.actor ?? { type: 'user', id: auth.sub },
      correlationId: req.correlation_id,
    },
    tool,
    req.input,
  );

  // HTTP status reflects gross outcome:
  //   - success=true  → 200
  //   - success=false → 200 too (business failures aren't HTTP errors)
  // Only auth/validation/routing failures return 4xx.
  return c.json(envelope, 200);
});

// ── Catch-all error handler ────────────────────────────────────────────────
app.onError((err, c) => {
  console.error('[server] unhandled error', err);
  return c.json(
    {
      success: false,
      status: 'error',
      data: null,
      warnings: [],
      errors: [{ code: 'UNKNOWN_ERROR', message: 'Internal server error' }],
      timestamp: new Date().toISOString(),
    },
    500,
  );
});

// ── Boot ────────────────────────────────────────────────────────────────────
serve({ fetch: app.fetch, port: env.PORT }, ({ port }) => {
  console.log(`▶ RestoAify backend listening on http://localhost:${port}`);
  console.log(`  health    GET  /health`);
  console.log(`  tools     GET  /tools           (auth + X-Tenant-Id)`);
  console.log(`  execute   POST /tools/execute   (auth + X-Tenant-Id)`);
});
