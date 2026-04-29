import type { z, ZodTypeAny } from 'zod';
import type { ToolEnvelope } from '../lib/envelope.js';
import type { ModuleCode } from './statuses.js';
import type { ToolHandlerArgs } from './context.js';

/**
 * Static metadata + runtime contract for a single tool.
 *
 * Each tool exports an object of this shape; the registry collects them and
 * the HTTP layer dispatches by `code` (e.g. "orders.create_draft").
 */
export interface ToolDefinition<
  TInputSchema extends ZodTypeAny = ZodTypeAny,
  TData = unknown,
> {
  /** Stable identifier exposed to clients/agents, e.g. "orders.create_draft". */
  readonly code: string;

  /** Module the tool belongs to. Used for entitlement checks and audit. */
  readonly moduleCode: ModuleCode;

  /** Semver-ish version string. Bumped on breaking changes. */
  readonly version: string;

  /** zod schema validating raw input. Output of .parse() is fed to handler. */
  readonly input: TInputSchema;

  /**
   * The actual implementation. Runs inside a transaction with
   * `app.current_tenant` already set. Throw `ToolError` for business failures;
   * anything else is caught and surfaced as UNKNOWN_ERROR.
   */
  readonly handler: (
    args: ToolHandlerArgs<z.infer<TInputSchema>>,
  ) => Promise<ToolEnvelope<TData>>;
}
