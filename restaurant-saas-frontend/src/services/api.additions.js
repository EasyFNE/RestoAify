// =============================================================================
// api.js — ADDITIONS for Operations modules (Conversations / Contacts / Orders)
// =============================================================================
// HOW TO INTEGRATE
//
// 1. Open `src/services/api.js`.
// 2. Paste the helpers in section [A] near the top (just below the existing
//    `uid()` / `sleep()` helpers).
// 3. Paste the methods in section [B] inside the `mock = { ... }` object.
// 4. Paste the methods in section [C] inside the `sb = { ... }` object.
//
// IMPORTANT — audit_logs schema
// audit_logs columns (per 02-data-model.md §9.2):
//   id, tenant_id, event_type, module_code, tool_code,
//   actor_type, actor_id, entity_type, entity_id, action, success,
//   correlation_id, reason, payload_summary, metadata, created_at
// ❌ no restaurant_id ❌ no other column.
// =============================================================================

// [A] HELPERS
const ORDER_TRANSITIONS = [
  ['draft', 'awaiting_confirmation'],
  ['draft', 'cancelled'],
  ['awaiting_confirmation', 'confirmed'],
  ['awaiting_confirmation', 'cancelled'],
  ['confirmed', 'in_preparation'],
  ['confirmed', 'cancelled'],
  ['in_preparation', 'ready'],
  ['in_preparation', 'cancelled'],
  ['ready', 'delivered'],
  ['delivered', 'closed'],
]

function isAllowedOrderTransition(from, to) {
  if (from === to) return false
  return ORDER_TRANSITIONS.some(([f, t]) => f === from && t === to)
}

function getActorForAudit() {
  try {
    const raw = localStorage.getItem('rsaas.auth.user')
    if (!raw) return { actor_type: 'system', actor_id: null }
    const u = JSON.parse(raw)
    return { actor_type: 'user', actor_id: u?.id || null }
  } catch {
    return { actor_type: 'system', actor_id: null }
  }
}
