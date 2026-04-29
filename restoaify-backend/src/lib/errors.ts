/**
 * Business error codes (exhaustive — see 04-tool-contracts.md §6.1).
 * Add new codes only when the agent / frontend needs to behave differently.
 */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'CONFLICT',
  'PERMISSION_DENIED',
  'ENTITLEMENT_MISSING',
  'INTEGRATION_ERROR',
  'RATE_LIMITED',
  'UNKNOWN_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/**
 * Throw inside a tool handler to short-circuit and produce a `success: false`
 * envelope with the given code/message. Anything else (TypeError, DB error,
 * etc.) is caught by wrapTool and surfaced as `UNKNOWN_ERROR`.
 */
export class ToolError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ToolError';
  }
}

export function notFound(message: string, details?: unknown): never {
  throw new ToolError('NOT_FOUND', message, details);
}

export function conflict(message: string, details?: unknown): never {
  throw new ToolError('CONFLICT', message, details);
}

export function permissionDenied(message: string, details?: unknown): never {
  throw new ToolError('PERMISSION_DENIED', message, details);
}

export function entitlementMissing(message: string, details?: unknown): never {
  throw new ToolError('ENTITLEMENT_MISSING', message, details);
}
