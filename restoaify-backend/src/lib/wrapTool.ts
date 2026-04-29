import { sql } from '../db/sql.js';
import { withTenant } from '../db/withTenant.js';
import type { ToolContext } from '../types/context.js';
import type { ToolDefinition } from '../types/tools.js';
import { summarizeEnvelope, writeAuditLog } from './audit.js';
import { isModuleEnabled } from './entitlements.js';
import { ToolError } from './errors.js';
import { fail, type ToolEnvelope } from './envelope.js';
import {
  buildIdempotencyKey,
  claimExecution,
  completeExecution,
} from './idempotency.js';

/**
 * The single entry point for executing a tool.
 *
 * Order of operations matters — each step is a guard:
 *   1. Validate input shape (zod) → bail VALIDATION_ERROR before touching DB.
 *   2. Open transaction + SET LOCAL app.current_tenant (RLS engaged).
 *   3. Check entitlement. Default-deny if no row.
 *   4. Claim/replay via tool_executions (idempotency).
 *      - Replay completed → return cached envelope, NO new audit log.
 *      - Replay in_progress → return CONFLICT.
 *      - Replay failed → re-run (treated as fresh attempt).
 *   5. Run handler.
 *   6. Persist outcome (tool_executions) + write audit_log.
 *
 * Notes on transaction scope:
 *  - Steps 2–6 share one transaction. If the handler throws, we still need
 *    to mark the execution as failed and write an audit, so we catch + commit
 *    the failure record. We never let the handler's error abort the audit.
 */
export async function executeTool(
  ctx: ToolContext,
  tool: ToolDefinition,
  rawInput: unknown,
): Promise<ToolEnvelope> {
  // Step 1 — input validation (no DB access yet)
  const parsed = tool.input.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION_ERROR', 'Input failed schema validation', {
      issues: parsed.error.flatten(),
    });
  }
  const input = parsed.data;
  const idempotencyKey = buildIdempotencyKey(tool.code, ctx.correlationId);
  const startedAt = Date.now();

  return withTenant(sql, ctx.tenantId, async (tx) => {
    // Step 3 — entitlement check
    const enabled = await isModuleEnabled(tx, tool.moduleCode);
    if (!enabled) {
      const env = fail(
        'ENTITLEMENT_MISSING',
        `Module '${tool.moduleCode}' is not enabled for this tenant`,
      );
      // Best-effort audit; if this fails we still return the envelope.
      await writeAuditLog(tx, ctx, {
        eventType: 'tool.entitlement_denied',
        moduleCode: tool.moduleCode,
        toolCode: tool.code,
        action: 'execute',
        success: false,
        reason: 'ENTITLEMENT_MISSING',
        payloadSummary: summarizeEnvelope(env),
      }).catch(() => undefined);
      return env;
    }

    // Step 4 — claim or replay
    const claim = await claimExecution(tx, ctx, {
      toolCode: tool.code,
      moduleCode: tool.moduleCode,
      version: tool.version,
      idempotencyKey,
      inputSnapshot: input,
    });

    if (claim.isReplay) {
      if (claim.status === 'completed' && claim.cachedOutput) {
        // Replay of a completed execution — return cached output.
        // No new audit log: the original was already written.
        return claim.cachedOutput;
      }
      if (claim.status === 'in_progress') {
        return fail(
          'CONFLICT',
          'Tool execution with this correlation_id is already in progress',
          { executionId: claim.id },
        );
      }
      // status === 'failed' → fall through and re-run. The retry_count was
      // already incremented in claimExecution.
    }

    // Step 5 — run handler
    let output: ToolEnvelope;
    try {
      output = await tool.handler({ tx, ctx, input });
    } catch (err) {
      if (err instanceof ToolError) {
        output = fail(err.code, err.message, err.details);
      } else {
        // Unknown error — log to console for now, surface a sanitized envelope.
        // In production, this should also write to technical_logs.
        console.error('[wrapTool] unexpected error', {
          tool: tool.code,
          correlationId: ctx.correlationId,
          error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
        });
        output = fail('UNKNOWN_ERROR', 'Internal error during tool execution');
      }
    }

    // Step 6 — persist + audit
    const durationMs = Date.now() - startedAt;
    await completeExecution(tx, claim.id, output, durationMs);
    await writeAuditLog(tx, ctx, {
      eventType: output.success ? 'tool.completed' : 'tool.failed',
      moduleCode: tool.moduleCode,
      toolCode: tool.code,
      action: 'execute',
      success: output.success,
      reason: output.success ? undefined : output.errors[0]?.code,
      payloadSummary: summarizeEnvelope(output),
      metadata: { durationMs, isReplay: claim.isReplay },
    });

    return output;
  });
}
