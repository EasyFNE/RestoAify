import type { TxSql } from '../db/sql.js';
import type { ToolContext } from '../types/context.js';
import type { ToolEnvelope } from './envelope.js';

interface AuditEntry {
  eventType: string;
  moduleCode: string;
  toolCode?: string | undefined;
  entityType?: string | undefined;
  entityId?: string | undefined;
  action?: string | undefined;
  success: boolean;
  reason?: string | undefined;
  payloadSummary?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

/**
 * Append a row to `audit_logs`. Always called from inside a `withTenant`
 * transaction so the row gets the right tenant_id via RLS.
 *
 * Payload summaries are truncated to 1000 chars: audit_logs.payload_summary
 * is `text` (no limit), but storing full payloads bloats the table fast.
 */
export async function writeAuditLog(
  tx: TxSql,
  ctx: ToolContext,
  entry: AuditEntry,
): Promise<void> {
  const summary = entry.payloadSummary?.slice(0, 1000) ?? null;

  await tx`
    INSERT INTO audit_logs (
      tenant_id, event_type, module_code, tool_code,
      actor_type, actor_id,
      entity_type, entity_id, action, success,
      correlation_id, reason, payload_summary, metadata
    )
    VALUES (
      ${ctx.tenantId}, ${entry.eventType}, ${entry.moduleCode}, ${entry.toolCode ?? null},
      ${ctx.actor.type}, ${ctx.actor.id},
      ${entry.entityType ?? null}, ${entry.entityId ?? null},
      ${entry.action ?? null}, ${entry.success},
      ${ctx.correlationId}, ${entry.reason ?? null}, ${summary},
      ${entry.metadata ? tx.json(entry.metadata as never) : null}
    )
  `;
}

/**
 * Build a one-line summary from a tool envelope. Cheap, lossy, fine for audit.
 */
export function summarizeEnvelope(env: ToolEnvelope): string {
  if (env.success) {
    return env.warnings.length
      ? `ok with ${env.warnings.length} warning(s)`
      : 'ok';
  }
  const first = env.errors[0];
  return first ? `${first.code}: ${first.message}` : 'error';
}
