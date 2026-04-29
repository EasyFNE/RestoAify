import { z } from 'zod';
import { ok } from '../../lib/envelope.js';
import { conflict, notFound } from '../../lib/errors.js';
import { writeAuditLog } from '../../lib/audit.js';
import type { ConversationRow } from '../../types/db.js';
import type { ToolDefinition } from '../../types/tools.js';

const InputSchema = z.object({
  conversation_id: z.string().uuid(),
  /** WhatsApp/Slack/etc. channel where the staff alert is delivered. */
  staff_channel_id: z.string().uuid(),
  /** Phone number / Slack channel id / etc. — the destination on that channel. */
  staff_destination: z.string().min(3).max(255),
  /** The text to send. Templating is the caller's responsibility. */
  message_text: z.string().min(1).max(4096),
  /** Optional reason surfaced in audit + status_history. */
  reason: z.string().max(500).optional(),
});

interface OutputData {
  conversation_id: string;
  conversation_status: 'awaiting_human';
  send_request_id: string;
  /** Echoes what the queued send_request looks like before n8n picks it up. */
  send_request: {
    id: string;
    delivery_status: 'not_sent';
    status: 'pending';
    idempotency_key: string;
  };
}

/**
 * Hand off a conversation to human staff. Two effects, one transaction:
 *  1. conversations.status becomes 'awaiting_human' (allowed from open /
 *     pending / handoff / human_handling per the CHECK; we don't allow
 *     from closed/archived).
 *  2. A row is INSERTed in channel_send_requests so the n8n outbound worker
 *     picks it up and delivers via the provider (Evolution API for WhatsApp,
 *     etc.). The backend deliberately does not call the provider itself —
 *     that's n8n's responsibility per 03-n8n-workflow-rules.md.
 *
 * Idempotency:
 *  - wrapTool's tool_executions cache makes the call as a whole idempotent.
 *  - channel_send_requests.idempotency_key is also set to
 *    `handoff:${correlation_id}` so a bypassed cache can't double-send.
 *  - The unique index ux_csr_idempotency on
 *    (tenant_id, channel_id, idempotency_key) does the deduplication.
 */
export const handoffNotifyStaff: ToolDefinition<typeof InputSchema, OutputData> = {
  code: 'handoff.notify_staff',
  moduleCode: 'handoff',
  version: 'v1',
  input: InputSchema,
  async handler({ tx, ctx, input }) {
    // 1. Verify conversation + status guard.
    const convRows = await tx<ConversationRow[]>`
      SELECT * FROM conversations WHERE id = ${input.conversation_id} LIMIT 1
    `;
    const conv = convRows[0];
    if (!conv) notFound(`Conversation ${input.conversation_id} not found`);

    const HANDOFFABLE = ['open', 'pending', 'handoff', 'human_handling'] as const;
    if (!HANDOFFABLE.includes(conv.status as 'open' | 'pending' | 'handoff' | 'human_handling')) {
      conflict(
        `Cannot hand off a conversation in status '${conv.status}'`,
        { status: conv.status, allowed: HANDOFFABLE },
      );
    }

    // 2. Verify the staff channel is active in this tenant.
    const chanRows = await tx<
      Array<{ id: string; channel_type: string; provider: string; status: string }>
    >`
      SELECT id, channel_type, provider, status
      FROM channels
      WHERE id = ${input.staff_channel_id}
      LIMIT 1
    `;
    const chan = chanRows[0];
    if (!chan) notFound(`Staff channel ${input.staff_channel_id} not found`);
    if (chan.status !== 'active') {
      conflict(`Staff channel is ${chan.status}, not active`);
    }

    // 3. Update conversation status. We keep it simple here (no dedicated
    //    status_history table for conversations in the current schema), and
    //    let the audit_log row be the source of truth for the transition.
    if (conv.status !== 'awaiting_human') {
      await tx`
        UPDATE conversations
        SET status     = 'awaiting_human',
            updated_at = now()
        WHERE id     = ${conv.id}
          AND status = ${conv.status}
      `;
    }

    // 4. Enqueue the staff alert. n8n's outbound workflow will:
    //    - poll/trigger on channel_send_requests where status='pending'
    //    - call the provider (Evolution API for WhatsApp)
    //    - update status='sent' / 'failed_provider' + delivery_status
    const idempotencyKey = `handoff:${ctx.correlationId}`;
    const payloadNormalized = {
      to: input.staff_destination,
      type: 'text',
      text: input.message_text,
    } as never;

    const inserted = await tx<
      Array<{ id: string; status: string; delivery_status: string; idempotency_key: string }>
    >`
      INSERT INTO channel_send_requests (
        tenant_id, restaurant_id, channel_id,
        contact_id, conversation_id,
        correlation_id, actor_type, actor_id,
        module_code, workflow_code,
        provider, channel_type,
        destination_value, message_type,
        payload_normalized, idempotency_key,
        status, success, sent, delivery_status
      ) VALUES (
        ${ctx.tenantId}, ${conv.restaurant_id ?? null}, ${input.staff_channel_id},
        ${conv.contact_id}, ${conv.id},
        ${ctx.correlationId}, ${ctx.actor.type}, ${ctx.actor.id},
        'handoff', 'handoff.notify_staff',
        ${chan.provider}, ${chan.channel_type},
        ${input.staff_destination}, 'text',
        ${tx.json(payloadNormalized)}, ${idempotencyKey},
        'pending', false, false, 'not_sent'
      )
      ON CONFLICT (tenant_id, channel_id, idempotency_key)
      WHERE idempotency_key IS NOT NULL
      DO NOTHING
      RETURNING id, status, delivery_status, idempotency_key
    `;

    let csr = inserted[0];
    if (!csr) {
      // Existing row from a prior call with the same key — fetch and return it.
      const existing = await tx<
        Array<{ id: string; status: string; delivery_status: string; idempotency_key: string }>
      >`
        SELECT id, status, delivery_status, idempotency_key
        FROM channel_send_requests
        WHERE channel_id     = ${input.staff_channel_id}
          AND idempotency_key = ${idempotencyKey}
        LIMIT 1
      `;
      if (!existing[0]) {
        throw new Error('handoff.notify_staff: ON CONFLICT but no existing send_request');
      }
      csr = existing[0];
    }

    // 5. Domain audit row (in addition to the tool-level one wrapTool writes).
    //    This is the row UIs read to show "handed off to staff" in the
    //    conversation timeline.
    await writeAuditLog(tx, ctx, {
      eventType: 'conversation.handoff_requested',
      moduleCode: 'handoff',
      toolCode: 'handoff.notify_staff',
      entityType: 'conversation',
      entityId: conv.id,
      action: 'handoff',
      success: true,
      reason: input.reason ?? undefined,
      payloadSummary: `to=${chan.channel_type}/${input.staff_destination}`,
      metadata: {
        staff_channel_id: input.staff_channel_id,
        send_request_id: csr.id,
      },
    });

    return ok<OutputData>({
      conversation_id: conv.id,
      conversation_status: 'awaiting_human',
      send_request_id: csr.id,
      send_request: {
        id: csr.id,
        delivery_status: 'not_sent',
        status: 'pending',
        idempotency_key: csr.idempotency_key,
      },
    });
  },
};
