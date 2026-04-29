import type { ErrorCode } from './errors.js';

/**
 * Standard tool envelope (see 04-tool-contracts.md §3).
 * Every tool returns this shape — including business failures.
 *
 * Notes on success vs errors:
 *  - `success=true` means the tool reached a meaningful business outcome.
 *  - `success=false` does NOT necessarily mean a technical failure: a
 *    `slot_unavailable` reservation is a normal business response and is
 *    encoded as `success=false` with a `CONFLICT` or domain-specific code.
 */
export interface ToolEnvelope<TData = unknown> {
  success: boolean;
  status: 'ok' | 'partial' | 'error';
  data: TData | null;
  warnings: Array<{ code: string; message: string }>;
  errors: Array<{ code: ErrorCode | string; message: string; details?: unknown }>;
  timestamp: string;
}

export function ok<TData>(
  data: TData,
  warnings: ToolEnvelope['warnings'] = [],
): ToolEnvelope<TData> {
  return {
    success: true,
    status: warnings.length ? 'partial' : 'ok',
    data,
    warnings,
    errors: [],
    timestamp: new Date().toISOString(),
  };
}

export function fail<TData = unknown>(
  code: ErrorCode | string,
  message: string,
  details?: unknown,
): ToolEnvelope<TData> {
  return {
    success: false,
    status: 'error',
    data: null,
    warnings: [],
    errors: [{ code, message, ...(details !== undefined ? { details } : {}) }],
    timestamp: new Date().toISOString(),
  };
}
