import { contactsGetOrCreate } from './contacts/getOrCreate.js';
import { contactsGetProfile } from './contacts/getProfile.js';
import { contactsUpdateProfile } from './contacts/updateProfile.js';
import { handoffNotifyStaff } from './handoff/notifyStaff.js';
import { ordersAddItem } from './orders/addItem.js';
import { ordersCancel } from './orders/cancel.js';
import { ordersConfirm } from './orders/confirm.js';
import { ordersCreateDraft } from './orders/createDraft.js';
import { ordersGetStatus } from './orders/getStatus.js';
import { ordersRemoveItem } from './orders/removeItem.js';
import { reservationsCancel } from './reservations/cancel.js';
import { reservationsCheckAvailability } from './reservations/checkAvailability.js';
import { reservationsCreate } from './reservations/create.js';
import { reservationsUpdate } from './reservations/update.js';
import type { ToolDefinition } from '../types/tools.js';

/**
 * Single source of truth for the tool catalog. The HTTP layer dispatches
 * by `code`. Adding a tool = exporting it from its module + registering it
 * here. Anything not in this map is a 404.
 */
const TOOLS: ReadonlyArray<ToolDefinition<any, any>> = [
  // contacts
  contactsGetOrCreate,
  contactsGetProfile,
  contactsUpdateProfile,
  // orders
  ordersCreateDraft,
  ordersAddItem,
  ordersRemoveItem,
  ordersConfirm,
  ordersCancel,
  ordersGetStatus,
  // reservations
  reservationsCheckAvailability,
  reservationsCreate,
  reservationsUpdate,
  reservationsCancel,
  // handoff
  handoffNotifyStaff,
];

const TOOL_INDEX = new Map(TOOLS.map((t) => [t.code, t]));

export function getTool(code: string): ToolDefinition<any, any> | undefined {
  return TOOL_INDEX.get(code);
}

export function listToolCodes(): string[] {
  return Array.from(TOOL_INDEX.keys()).sort();
}
