import type { TxSql } from '../db/sql.js';

/**
 * The end-to-end context that every tool execution carries.
 * Built once per request by `requireTenantContext` middleware and frozen.
 *
 * Mandatory fields are baked into types so a tool cannot accidentally run
 * without them. Optional fields (conversation, contact) are tool-specific.
 */
export interface ToolContext {
  readonly tenantId: string;
  readonly restaurantId?: string | undefined;
  readonly conversationId?: string | undefined;
  readonly contactId?: string | undefined;
  readonly actor: {
    readonly type: 'user' | 'agent' | 'system';
    readonly id: string | null;
  };
  readonly correlationId: string;
}

/**
 * Arguments passed to every tool handler. The handler runs INSIDE the
 * transaction opened by wrapTool, with `app.current_tenant` already set.
 */
export interface ToolHandlerArgs<TInput> {
  readonly tx: TxSql;
  readonly ctx: ToolContext;
  readonly input: TInput;
}
