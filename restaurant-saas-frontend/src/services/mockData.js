// =============================================================================
// mockData.js — seed data for DEMO / TRIAL mode only.
//
// ⚠  This file is NOT active in production.
//     It is only loaded when VITE_DATA_SOURCE=mock is explicitly set.
//     In supabase mode (default) this module exports nothing useful
//     and the `seed` export will throw if accidentally consumed.
//
// To use mock mode: set VITE_DATA_SOURCE=mock in your .env.local
// =============================================================================

const IS_MOCK = import.meta.env.VITE_DATA_SOURCE === 'mock'

if (!IS_MOCK) {
  // Guard: in supabase mode, nothing below should ever be imported.
  // If you see this error, a component is incorrectly importing from mockData.
  console.warn(
    '[mockData] This file should not be loaded in supabase mode. ' +
    'Check that no component imports directly from mockData.js.',
  )
}

// ── Platform / tenant constants ──────────────────────────────────────────────
const PLAN_STARTER    = 'plan-starter'
const PLAN_PRO        = 'plan-pro'
const PLAN_ENTERPRISE = 'plan-enterprise'

const TENANT_LE_SPOT  = 'tenant-le-spot'
const USER_OWNER      = 'user-owner-1'
const USER_ADMIN      = 'user-admin-1'
const USER_STAFF      = 'user-staff-1'
const USER_PLATFORM   = 'user-platform-1'

const RESTO_LS_1 = 'resto-ls-plateau'
const RESTO_LS_2 = 'resto-ls-cocody'

// ── Operations constants ─────────────────────────────────────────────────
const CONTACT_AICHA  = 'cont-1'
const CONTACT_KOUAME = 'cont-2'
const CONTACT_FATOU  = 'cont-3'
const CONTACT_YAO    = 'cont-4'

const CONV_AICHA_ORDER   = 'cv-1'
const CONV_KOUAME_INFO   = 'cv-2'
const CONV_FATOU_HANDOFF = 'cv-3'

const ORDER_AICHA_DRAFT      = 'ord-1'
const ORDER_KOUAME_DELIVERED = 'ord-2'
const ORDER_FATOU_PREP       = 'ord-3'
const ORDER_YAO_CANCELLED    = 'ord-4'

// ─────────────────────────────────────────────────────────────────────────────

export const seed = IS_MOCK ? {
  plans: [
    { id: PLAN_STARTER,    code: 'starter',    name: 'Starter',    status: 'active', created_at: '2025-01-01T00:00:00Z' },
    { id: PLAN_PRO,        code: 'pro',        name: 'Pro',        status: 'active', created_at: '2025-01-01T00:00:00Z' },
    { id: PLAN_ENTERPRISE, code: 'enterprise', name: 'Enterprise', status: 'active', created_at: '2025-01-01T00:00:00Z' },
  ],
  tenants: [
    { id: TENANT_LE_SPOT, name: 'Le Spot', slug: 'le-spot', status: 'active', plan_id: PLAN_PRO, created_at: '2025-01-15T10:00:00Z', updated_at: '2025-01-15T10:00:00Z' },
  ],
  users: [
    { id: USER_PLATFORM, email: 'platform@rsaas.io',  full_name: 'Platform Admin', status: 'active', scope: 'platform', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
    { id: USER_OWNER,    email: 'owner@lespot.ci',     full_name: 'Moussa Koné',    status: 'active', scope: 'tenant',   created_at: '2025-01-15T10:00:00Z', updated_at: '2025-01-15T10:00:00Z' },
    { id: USER_ADMIN,    email: 'admin@lespot.ci',     full_name: 'Aminata Diallo', status: 'active', scope: 'tenant',   created_at: '2025-01-20T09:00:00Z', updated_at: '2025-01-20T09:00:00Z' },
    { id: USER_STAFF,    email: 'staff@lespot.ci',     full_name: 'Kofi Asante',    status: 'active', scope: 'tenant',   created_at: '2025-02-01T08:00:00Z', updated_at: '2025-02-01T08:00:00Z' },
  ],
  tenant_users: [
    { id: 'tu-1', tenant_id: TENANT_LE_SPOT, user_id: USER_OWNER, role_code: 'tenant_owner', status: 'active', created_at: '2025-01-15T10:00:00Z' },
    { id: 'tu-2', tenant_id: TENANT_LE_SPOT, user_id: USER_ADMIN, role_code: 'tenant_admin', status: 'active', created_at: '2025-01-20T09:00:00Z' },
    { id: 'tu-3', tenant_id: TENANT_LE_SPOT, user_id: USER_STAFF, role_code: 'staff',        status: 'active', created_at: '2025-02-01T08:00:00Z' },
  ],
  restaurants: [
    { id: RESTO_LS_1, tenant_id: TENANT_LE_SPOT, name: 'Le Spot — Plateau', restaurant_type: 'restaurant', timezone: 'Africa/Abidjan', currency: 'XOF', address: 'Rue du Commerce, Plateau, Abidjan', status: 'active', created_at: '2025-01-15T10:00:00Z', updated_at: '2025-01-15T10:00:00Z' },
    { id: RESTO_LS_2, tenant_id: TENANT_LE_SPOT, name: 'Le Spot — Cocody',  restaurant_type: 'restaurant', timezone: 'Africa/Abidjan', currency: 'XOF', address: 'Angré 8ème Tranche, Cocody, Abidjan', status: 'active', created_at: '2025-02-10T09:00:00Z', updated_at: '2025-02-10T09:00:00Z' },
  ],
  restaurant_users: [
    { id: 'ru-1', tenant_id: TENANT_LE_SPOT, restaurant_id: RESTO_LS_1, user_id: USER_ADMIN, role_code: 'manager', status: 'active', created_at: '2025-01-20T09:00:00Z' },
    { id: 'ru-2', tenant_id: TENANT_LE_SPOT, restaurant_id: RESTO_LS_2, user_id: USER_STAFF, role_code: 'staff',   status: 'active', created_at: '2025-02-01T08:00:00Z' },
  ],
  tenant_entitlements: [
    { id: 'ent-1', tenant_id: TENANT_LE_SPOT, module_code: 'contacts',     feature_code: null, enabled: true,  source: 'plan',     created_at: '2025-01-15T10:00:00Z', updated_at: '2025-01-15T10:00:00Z' },
    { id: 'ent-2', tenant_id: TENANT_LE_SPOT, module_code: 'menus',        feature_code: null, enabled: true,  source: 'plan',     created_at: '2025-01-15T10:00:00Z', updated_at: '2025-01-15T10:00:00Z' },
    { id: 'ent-3', tenant_id: TENANT_LE_SPOT, module_code: 'orders',       feature_code: null, enabled: true,  source: 'plan',     created_at: '2025-01-15T10:00:00Z', updated_at: '2025-01-15T10:00:00Z' },
    { id: 'ent-4', tenant_id: TENANT_LE_SPOT, module_code: 'handoff',      feature_code: null, enabled: true,  source: 'plan',     created_at: '2025-01-15T10:00:00Z', updated_at: '2025-01-15T10:00:00Z' },
    { id: 'ent-5', tenant_id: TENANT_LE_SPOT, module_code: 'reservations', feature_code: null, enabled: true,  source: 'plan',     created_at: '2025-01-15T10:00:00Z', updated_at: '2025-01-15T10:00:00Z' },
    { id: 'ent-6', tenant_id: TENANT_LE_SPOT, module_code: 'catering',     feature_code: null, enabled: false, source: 'override', created_at: '2025-03-01T00:00:00Z', updated_at: '2025-03-01T00:00:00Z' },
  ],
  channels: [
    { id: 'ch-1', tenant_id: TENANT_LE_SPOT, channel_type: 'whatsapp', provider: 'meta', external_channel_id: '+2250700112233', status: 'active', created_at: '2025-01-15T10:00:00Z' },
  ],
  audit_logs: [
    { id: 'al-1', tenant_id: TENANT_LE_SPOT, actor_type: 'user', actor_id: USER_OWNER, entity_type: 'tenant', entity_id: TENANT_LE_SPOT, action: 'tenant.created', metadata: {}, created_at: '2025-01-15T10:00:00Z' },
  ],
  contacts: [
    { id: CONTACT_AICHA,  tenant_id: TENANT_LE_SPOT, default_restaurant_id: RESTO_LS_1, full_name: 'Aïcha Traoré',  first_name: 'Aïcha',  last_name: 'Traoré',  email: 'aicha.traore@example.ci', language: 'fr', notes: 'Cliente régulière', status: 'active', merged_into_id: null, created_at: '2025-02-10T09:00:00Z', updated_at: '2025-04-28T18:30:00Z' },
    { id: CONTACT_KOUAME, tenant_id: TENANT_LE_SPOT, default_restaurant_id: RESTO_LS_2, full_name: 'Kouamé Bamba',  first_name: 'Kouamé', last_name: 'Bamba',   email: null,                     language: 'fr', notes: null,             status: 'active', merged_into_id: null, created_at: '2025-03-05T11:15:00Z', updated_at: '2025-04-25T12:00:00Z' },
    { id: CONTACT_FATOU,  tenant_id: TENANT_LE_SPOT, default_restaurant_id: RESTO_LS_1, full_name: 'Fatou Diallo',  first_name: 'Fatou',   last_name: 'Diallo',  email: 'f.diallo@example.ci',    language: 'fr', notes: 'Allergie arachides', status: 'active', merged_into_id: null, created_at: '2025-03-22T17:00:00Z', updated_at: '2025-04-30T08:45:00Z' },
    { id: CONTACT_YAO,    tenant_id: TENANT_LE_SPOT, default_restaurant_id: null,       full_name: "Yao N'Dri",    first_name: 'Yao',     last_name: "N'Dri",   email: null,                     language: 'fr', notes: null,             status: 'active', merged_into_id: null, created_at: '2025-04-12T14:20:00Z', updated_at: '2025-04-12T14:20:00Z' },
  ],
  contact_channels: [
    { id: 'cch-1', tenant_id: TENANT_LE_SPOT, contact_id: CONTACT_AICHA,  channel_type: 'whatsapp', channel_value: '+2250707112233', is_primary: true },
    { id: 'cch-2', tenant_id: TENANT_LE_SPOT, contact_id: CONTACT_KOUAME, channel_type: 'whatsapp', channel_value: '+2250505445566', is_primary: true },
    { id: 'cch-3', tenant_id: TENANT_LE_SPOT, contact_id: CONTACT_FATOU,  channel_type: 'whatsapp', channel_value: '+2250101778899', is_primary: true },
    { id: 'cch-4', tenant_id: TENANT_LE_SPOT, contact_id: CONTACT_YAO,    channel_type: 'whatsapp', channel_value: '+2250708990011', is_primary: true },
  ],
  conversations: [
    { id: CONV_AICHA_ORDER,   tenant_id: TENANT_LE_SPOT, restaurant_id: RESTO_LS_1, contact_id: CONTACT_AICHA,  channel_id: 'ch-1', status: 'open',           current_context_type: 'order', current_context_id: ORDER_AICHA_DRAFT, last_message_at: '2025-05-02T19:42:00Z', created_at: '2025-05-02T19:30:00Z', updated_at: '2025-05-02T19:42:00Z' },
    { id: CONV_KOUAME_INFO,   tenant_id: TENANT_LE_SPOT, restaurant_id: RESTO_LS_2, contact_id: CONTACT_KOUAME, channel_id: 'ch-1', status: 'open',           current_context_type: null,    current_context_id: null,             last_message_at: '2025-05-01T13:10:00Z', created_at: '2025-05-01T13:05:00Z', updated_at: '2025-05-01T13:10:00Z' },
    { id: CONV_FATOU_HANDOFF, tenant_id: TENANT_LE_SPOT, restaurant_id: RESTO_LS_1, contact_id: CONTACT_FATOU,  channel_id: 'ch-1', status: 'awaiting_human', current_context_type: null,    current_context_id: null,             last_message_at: '2025-04-30T08:45:00Z', created_at: '2025-04-30T08:30:00Z', updated_at: '2025-04-30T08:45:00Z' },
  ],
  messages: [
    { id: 'msg-1', tenant_id: TENANT_LE_SPOT, conversation_id: CONV_AICHA_ORDER,   direction: 'inbound',  message_type: 'text', provider_message_id: 'wa_001', raw_payload: {}, normalized_text: 'Bonsoir, je voudrais commander pour 2 personnes svp', created_at: '2025-05-02T19:30:00Z' },
    { id: 'msg-2', tenant_id: TENANT_LE_SPOT, conversation_id: CONV_AICHA_ORDER,   direction: 'outbound', message_type: 'text', provider_message_id: 'wa_002', raw_payload: {}, normalized_text: 'Bonsoir Aïcha 👋 Avec plaisir. Livraison ou retrait ?', created_at: '2025-05-02T19:31:00Z' },
    { id: 'msg-3', tenant_id: TENANT_LE_SPOT, conversation_id: CONV_AICHA_ORDER,   direction: 'inbound',  message_type: 'text', provider_message_id: 'wa_003', raw_payload: {}, normalized_text: 'Livraison au Plateau.', created_at: '2025-05-02T19:33:00Z' },
    { id: 'msg-4', tenant_id: TENANT_LE_SPOT, conversation_id: CONV_KOUAME_INFO,   direction: 'inbound',  message_type: 'text', provider_message_id: 'wa_006', raw_payload: {}, normalized_text: 'Bonjour, vous êtes ouverts dimanche ?', created_at: '2025-05-01T13:05:00Z' },
    { id: 'msg-5', tenant_id: TENANT_LE_SPOT, conversation_id: CONV_KOUAME_INFO,   direction: 'outbound', message_type: 'text', provider_message_id: 'wa_007', raw_payload: {}, normalized_text: 'Oui, le restaurant Cocody est ouvert dimanche de 12h à 23h.', created_at: '2025-05-01T13:10:00Z' },
    { id: 'msg-6', tenant_id: TENANT_LE_SPOT, conversation_id: CONV_FATOU_HANDOFF, direction: 'inbound',  message_type: 'text', provider_message_id: 'wa_008', raw_payload: {}, normalized_text: "Ma commande contenait des arachides. C'est grave.", created_at: '2025-04-30T08:30:00Z' },
    { id: 'msg-7', tenant_id: TENANT_LE_SPOT, conversation_id: CONV_FATOU_HANDOFF, direction: 'outbound', message_type: 'text', provider_message_id: 'wa_009', raw_payload: {}, normalized_text: 'Madame Diallo, un responsable va vous contacter immédiatement.', created_at: '2025-04-30T08:45:00Z' },
  ],
  orders: [
    { id: ORDER_AICHA_DRAFT,      tenant_id: TENANT_LE_SPOT, restaurant_id: RESTO_LS_1, contact_id: CONTACT_AICHA,  conversation_id: CONV_AICHA_ORDER, correlation_id: 'cor-aicha-2025-05-02-1',  order_number: 'LS-2025-00041', service_type: 'delivery', status: 'draft',        subtotal_amount: 7500, total_amount: 7500, items_count: 3, currency: 'XOF', requested_for: '2025-05-02T20:30:00Z', notes: 'Livraison au Plateau, étage 3.', created_at: '2025-05-02T19:35:00Z', updated_at: '2025-05-02T19:42:00Z' },
    { id: ORDER_KOUAME_DELIVERED, tenant_id: TENANT_LE_SPOT, restaurant_id: RESTO_LS_2, contact_id: CONTACT_KOUAME, conversation_id: null,             correlation_id: 'cor-kouame-2025-04-25-1', order_number: 'LS-2025-00038', service_type: 'pickup',   status: 'delivered',    subtotal_amount: 5500, total_amount: 5500, items_count: 2, currency: 'XOF', requested_for: '2025-04-25T13:00:00Z', notes: null, created_at: '2025-04-25T11:50:00Z', updated_at: '2025-04-25T13:20:00Z' },
    { id: ORDER_FATOU_PREP,       tenant_id: TENANT_LE_SPOT, restaurant_id: RESTO_LS_1, contact_id: CONTACT_FATOU,  conversation_id: null,             correlation_id: 'cor-fatou-2025-05-02-1',  order_number: 'LS-2025-00040', service_type: 'dine_in',  status: 'in_preparation', subtotal_amount: 9000, total_amount: 9000, items_count: 2, currency: 'XOF', requested_for: '2025-05-02T20:00:00Z', notes: '⚠ Allergie arachides', created_at: '2025-05-02T19:15:00Z', updated_at: '2025-05-02T19:50:00Z' },
    { id: ORDER_YAO_CANCELLED,    tenant_id: TENANT_LE_SPOT, restaurant_id: RESTO_LS_1, contact_id: CONTACT_YAO,    conversation_id: null,             correlation_id: 'cor-yao-2025-04-12-1',    order_number: 'LS-2025-00033', service_type: 'delivery', status: 'cancelled',    subtotal_amount: 4000, total_amount: 4000, items_count: 1, currency: 'XOF', requested_for: null, notes: null, created_at: '2025-04-12T14:20:00Z', updated_at: '2025-04-12T14:35:00Z' },
  ],
  order_items: [
    { id: 'oi-1', tenant_id: TENANT_LE_SPOT, order_id: ORDER_AICHA_DRAFT,      qty: 2, unit_price: 3000, total_price: 6000, line_total: 6000, selected_option_ids: [], special_instructions: null,                        item_name_snapshot: 'Thieboudienne du jour',       selected_options_snapshot: null, menu_item_id: null, menu_item_variant_id: null },
    { id: 'oi-2', tenant_id: TENANT_LE_SPOT, order_id: ORDER_AICHA_DRAFT,      qty: 1, unit_price: 1500, total_price: 1500, line_total: 1500, selected_option_ids: [], special_instructions: null,                        item_name_snapshot: 'Alloco',                      selected_options_snapshot: null, menu_item_id: null, menu_item_variant_id: null },
    { id: 'oi-3', tenant_id: TENANT_LE_SPOT, order_id: ORDER_KOUAME_DELIVERED, qty: 1, unit_price: 3500, total_price: 3500, line_total: 3500, selected_option_ids: [], special_instructions: null,                        item_name_snapshot: 'Kedjenou de poulet',          selected_options_snapshot: null, menu_item_id: null, menu_item_variant_id: null },
    { id: 'oi-4', tenant_id: TENANT_LE_SPOT, order_id: ORDER_KOUAME_DELIVERED, qty: 1, unit_price: 2000, total_price: 2000, line_total: 2000, selected_option_ids: [], special_instructions: null,                        item_name_snapshot: 'Attiéké poisson',             selected_options_snapshot: null, menu_item_id: null, menu_item_variant_id: null },
    { id: 'oi-5', tenant_id: TENANT_LE_SPOT, order_id: ORDER_FATOU_PREP,       qty: 1, unit_price: 2500, total_price: 2500, line_total: 2500, selected_option_ids: [], special_instructions: 'Pas de sauce arachide',    item_name_snapshot: 'Garba',                       selected_options_snapshot: null, menu_item_id: null, menu_item_variant_id: null },
    { id: 'oi-6', tenant_id: TENANT_LE_SPOT, order_id: ORDER_FATOU_PREP,       qty: 1, unit_price: 6500, total_price: 6500, line_total: 6500, selected_option_ids: [], special_instructions: "⚠ vérifier absence d'arachides", item_name_snapshot: 'Plateau healthy poulet grillé',  selected_options_snapshot: null, menu_item_id: null, menu_item_variant_id: null },
    { id: 'oi-7', tenant_id: TENANT_LE_SPOT, order_id: ORDER_YAO_CANCELLED,    qty: 1, unit_price: 4000, total_price: 4000, line_total: 4000, selected_option_ids: [], special_instructions: null,                        item_name_snapshot: 'Thieboudienne royale',        selected_options_snapshot: null, menu_item_id: null, menu_item_variant_id: null },
  ],
  order_status_history: [
    { id: 'osh-1', tenant_id: TENANT_LE_SPOT, order_id: ORDER_KOUAME_DELIVERED, from_status: 'draft',                 to_status: 'awaiting_confirmation', actor_type: 'user', actor_id: USER_STAFF, reason: null,               created_at: '2025-04-25T11:52:00Z' },
    { id: 'osh-2', tenant_id: TENANT_LE_SPOT, order_id: ORDER_KOUAME_DELIVERED, from_status: 'awaiting_confirmation', to_status: 'confirmed',             actor_type: 'user', actor_id: USER_STAFF, reason: null,               created_at: '2025-04-25T11:55:00Z' },
    { id: 'osh-3', tenant_id: TENANT_LE_SPOT, order_id: ORDER_KOUAME_DELIVERED, from_status: 'confirmed',             to_status: 'in_preparation',        actor_type: 'user', actor_id: USER_STAFF, reason: null,               created_at: '2025-04-25T12:10:00Z' },
    { id: 'osh-4', tenant_id: TENANT_LE_SPOT, order_id: ORDER_KOUAME_DELIVERED, from_status: 'in_preparation',        to_status: 'ready',                 actor_type: 'user', actor_id: USER_STAFF, reason: null,               created_at: '2025-04-25T12:50:00Z' },
    { id: 'osh-5', tenant_id: TENANT_LE_SPOT, order_id: ORDER_KOUAME_DELIVERED, from_status: 'ready',                 to_status: 'delivered',             actor_type: 'user', actor_id: USER_STAFF, reason: null,               created_at: '2025-04-25T13:20:00Z' },
    { id: 'osh-6', tenant_id: TENANT_LE_SPOT, order_id: ORDER_YAO_CANCELLED,    from_status: 'draft',                 to_status: 'cancelled',             actor_type: 'user', actor_id: USER_ADMIN, reason: 'Client injoignable', created_at: '2025-04-12T14:35:00Z' },
    { id: 'osh-7', tenant_id: TENANT_LE_SPOT, order_id: ORDER_FATOU_PREP,       from_status: 'draft',                 to_status: 'awaiting_confirmation', actor_type: 'user', actor_id: USER_STAFF, reason: null,               created_at: '2025-05-02T19:20:00Z' },
    { id: 'osh-8', tenant_id: TENANT_LE_SPOT, order_id: ORDER_FATOU_PREP,       from_status: 'awaiting_confirmation', to_status: 'confirmed',             actor_type: 'user', actor_id: USER_STAFF, reason: null,               created_at: '2025-05-02T19:30:00Z' },
    { id: 'osh-9', tenant_id: TENANT_LE_SPOT, order_id: ORDER_FATOU_PREP,       from_status: 'confirmed',             to_status: 'in_preparation',        actor_type: 'user', actor_id: USER_STAFF, reason: null,               created_at: '2025-05-02T19:50:00Z' },
  ],
} : {}
// In supabase mode, seed is an empty object — never used.
