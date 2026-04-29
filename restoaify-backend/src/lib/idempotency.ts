import type { TxSql } from '../db/sql.js';
import type { ToolContext } from '../types/context.js';
import type { ToolEnvelope } from './envelope.js';

export type ExecutionStatus = 'in_progress' | 'completed' | 'failed';

interface ClaimResult {
  /** Existing or newly-created tool_executions row ID. */
  id: string;
  /** Current status. If 'completed', `cachedOutput` is populated. */
  status: ExecutionStatus;
  /** True if this exact (tenant, idempotency_key) was seen before. */
  isReplay: boolean;
  /** Cached envelope if status === 'completed'. */
  cachedOutput: ToolEnvelope | null;
}

/**
 * Idempotency key = `${tool_code}:${correlation_id}`.
 *
 * The same correlation_id can appear across multiple tool calls in the same
 * conversation (it tracks the end-to-end flow), so we scope the idempotency
 * key by tool_code as well. The unique index on tool_executions is
 * (tenant_id, idempotency_key).
 */
export function buildIdempotencyKey(toolCode: string, correlationId: string): string {
  return `${toolCode}:${correlationId}`;
}

/**
 * Atomically claim or replay an execution.
 *
 * Behaviour:
 *  - First call: inserts row with status='in_progress', returns isReplay=false.
 *  - Replay of completed: returns status='completed' + cached output_payload.
 *  - Replay of in_progress: returns status='in_progress' (caller decides:
 *    409 to client, or wait/poll). The retry_count is incremented.
 *  - Replay of failed: returns status='failed' (caller decides; v1 = retry by
 *    inserting a new row would lose the original; we surface the failure).
 *
 * Implementation: ON CONFLICT DO UPDATE SET retry_count = retry_count + 1
 * gives us atomic "claim or notice the existing row" without an extra round-trip.
 */
export async function claimExecution(
  tx: TxSql,
  ctx: ToolContext,
  args: {
    toolCode: string;
    moduleCode: string;
    version: string;
    idempotencyKey: string;
    inputSnapshot: unknown;
  },
): Promise<ClaimResult> {
  const rows = await tx<
    Array<{
      id: string;
      status: ExecutionStatus;
      output_payload: ToolEnvelope | null;
      is_new: boolean;
    }>
  >`
    INSERT INTO tool_executions (
      tenant_id, correlation_id, conversation_id, contact_id,
      tool_code, module_code, version, idempotency_key,
      actor_type, actor_id,
      status, input_snapshot
    )
    VALUES (
      ${ctx.tenantId}, ${ctx.correlationId}, ${ctx.conversationId ?? null}, ${ctx.contactId ?? null},
      ${args.toolCode}, ${args.moduleCode}, ${args.version}, ${args.idempotencyKey},
      ${ctx.actor.type}, ${ctx.actor.id},
      'in_progress', ${tx.json(args.inputSnapshot as never)}
    )
    ON CONFLICT (tenant_id, idempotency_key) DO UPDATE
      SET retry_count = tool_executions.retry_count + 1
    RETURNING
      id, status, output_payload,
      (xmax = 0) AS is_new
  `;

  const row = rows[0];
  if (!row) {
    // Should never happen — INSERT ... ON CONFLICT always returns a row.
    throw new Error('claimExecution: no row returned');
  }

  return {
    id: row.id,
    status: row.status,
    isReplay: !row.is_new,
    cachedOutput: row.status === 'completed' ? row.output_payload : null,
  };
}

/**
 * Mark an execution as completed (or failed) and persist the output envelope.
 * Called by wrapTool after the handler runs.
 */
export async function completeExecution(
  tx: TxSql,
  executionId: string,
  output: ToolEnvelope,
  durationMs: number,
): Promise<void> {
  const status: ExecutionStatus = output.success ? 'completed' : 'failed';
  const errorCode = output.errors[0]?.code ?? null;
  const errorMessage = output.errors[0]?.message ?? null;

  await tx`
    UPDATE tool_executions
    SET status         = ${status},
        output_payload = ${tx.json(output as never)},
        error_code     = ${errorCode},
        error_message  = ${errorMessage},
        duration_ms    = ${durationMs},
        completed_at   = now(),
        updated_at     = now()
    WHERE id = ${executionId}
  `;
}
