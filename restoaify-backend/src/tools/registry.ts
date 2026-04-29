import { contactsGetOrCreate } from './contacts/getOrCreate.js';
import { ordersCancel } from './orders/cancel.js';
import { ordersConfirm } from './orders/confirm.js';
import { ordersCreateDraft } from './orders/createDraft.js';
import { reservationsCreate } from './reservations/create.js';
import type { ToolDefinition } from '../types/tools.js';

/**
 * Single source of truth for the tool catalog. The HTTP layer dispatches
 * by `code`. Adding a tool = exporting it from its module + registering it
 * here. Anything not in this map is a 404.
 */
const TOOLS: ReadonlyArray<ToolDefinition<any, any>> = [
  contactsGetOrCreate,
  ordersCreateDraft,
  ordersConfirm,
  ordersCancel,
  reservationsCreate,
];

const TOOL_INDEX = new Map(TOOLS.map((t) => [t.code, t]));

export function getTool(code: string): ToolDefinition<any, any> | undefined {
  return TOOL_INDEX.get(code);
}

export function listToolCodes(): string[] {
  return Array.from(TOOL_INDEX.keys()).sort();
}
