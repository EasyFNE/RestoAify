# RestoAify backend

Node.js + TypeScript backend exposing tool handlers for the RestoAify platform.
Sits between the frontend / n8n workflows and the Supabase Postgres database.

## Stack

- **HTTP**: Hono (Node adapter)
- **DB**: postgres.js, direct connection through Supabase Transaction Pooler (port 6543)
- **Auth**: Supabase JWTs verified locally with jose (HS256)
- **Validation**: zod
- **Multi-tenant**: every tool runs inside a transaction with `SET LOCAL app.current_tenant`, RLS does the rest

## Quick start

```bash
cp .env.example .env
# fill in DATABASE_URL (Supabase pooler, port 6543) and SUPABASE_JWT_SECRET
npm install
npm run dev
```

Health check:
```bash
curl http://localhost:8787/health
```

## Endpoints

- `GET /health` — DB liveness, no auth.
- `GET /tools` — list registered tool codes. Requires `Authorization: Bearer <jwt>` and `X-Tenant-Id`.
- `POST /tools/execute` — single dispatch endpoint.

Example call:

```bash
curl -X POST http://localhost:8787/tools/execute \
  -H "Authorization: Bearer $JWT" \
  -H "X-Tenant-Id: 11111111-1111-1111-1111-111111111111" \
  -H "Content-Type: application/json" \
  -d '{
    "tool_code": "orders.create_draft",
    "correlation_id": "conv-abc-msg-42",
    "conversation_id": "...",
    "contact_id": "...",
    "input": {
      "restaurant_id": "bbbbbbbb-0000-0000-0000-000000000001",
      "contact_id": "...",
      "service_type": "delivery"
    }
  }'
```

Response (success):

```json
{
  "success": true,
  "status": "ok",
  "data": {
    "order_id": "...",
    "order_number": "ORD-...",
    "status": "draft",
    "order": { ... }
  },
  "warnings": [],
  "errors": [],
  "timestamp": "2026-04-28T..."
}
```

Replay (same `correlation_id` + same `tool_code`) returns the exact same envelope from the `tool_executions` cache — no side effects.

## What's implemented in v1

| Tool | Status |
|------|--------|
| `contacts.get_or_create` | ✅ |
| `orders.create_draft` | ✅ |
| `orders.confirm` | ✅ |
| `orders.cancel` | ✅ |
| `reservations.create` | ✅ |
| `contacts.update_profile`, `contacts.get_profile` | ⏳ |
| `orders.add_item`, `orders.remove_item`, `orders.get_status` | ⏳ |
| `reservations.check_availability`, `reservations.update`, `reservations.cancel` | ⏳ |
| `handoff.notify_staff` | ⏳ |

## Architecture notes

### Why postgres.js, not @supabase/supabase-js

The backend needs `SET LOCAL app.current_tenant` per request to drive RLS.
`@supabase/supabase-js` wraps PostgREST which doesn't expose transaction-bound
connections. postgres.js + the Supabase transaction pooler (port 6543) gives
us atomic `BEGIN ... SET LOCAL ... COMMIT` blocks per tool execution.

### Why port 6543 (transaction pool) is mandatory

`SET LOCAL` is bound to a transaction. With session pooling (port 5432), a
backend connection persists across multiple client requests and the GUC
could leak. Transaction pooling allocates a fresh backend per `BEGIN/COMMIT`,
so isolation holds even under load. The env loader refuses any other port.

### Idempotency at two levels

1. **`tool_executions` table** caches the full envelope, keyed by
   `(tenant_id, "${tool_code}:${correlation_id}")`. Replay of a completed
   execution short-circuits the handler entirely.
2. **Domain-level unique indexes** (e.g. `orders.UNIQUE(tenant_id, correlation_id)`)
   are a belt-and-suspenders against bypass attempts.

### Status transitions are validated, never blind UPDATE

`applyTransition()` enforces the allowed `[from, to]` pairs from
`types/statuses.ts` and writes the corresponding `*_status_history` row in
the same transaction. The optimistic UPDATE includes `WHERE status = from`
to detect concurrent transitions and surface `CONFLICT`.

### Audit trail

Every tool execution writes one row to `audit_logs` with the correlation_id.
Replay of a completed execution does NOT re-write audit (the original row
already exists). Failed executions are audited too, with the error code in
`reason`.

## Adding a new tool

1. Create `src/tools/<module>/<verb>.ts` exporting a `ToolDefinition`.
2. Register it in `src/tools/registry.ts`.
3. Add literal types/transitions to `src/types/statuses.ts` if needed.

The wrapTool runtime handles entitlement checks, idempotency, transitions,
and audit. The handler only worries about business logic.

## Testing locally with the seed tenant

The frontend's seed creates tenant `11111111-1111-1111-1111-111111111111`
("Le Spot") with restaurants and entitlements for orders/reservations.
That's the easiest tenant to point this backend at.
