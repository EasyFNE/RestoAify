// Mock data conforming to 02-data-model.md.
// Field names match the SQL schema so swapping to Supabase requires
// no component changes.

const TENANT_LE_SPOT = '11111111-1111-1111-1111-111111111111'
const TENANT_OASIS   = '22222222-2222-2222-2222-222222222222'

const RESTO_LS_1 = 'a1111111-0000-0000-0000-000000000001'
const RESTO_LS_2 = 'a1111111-0000-0000-0000-000000000002'
const RESTO_OA_1 = 'a2222222-0000-0000-0000-000000000001'

const USER_PLATFORM = 'u0000000-0000-0000-0000-00000000aaaa'
const USER_OWNER_LS = 'u0000000-0000-0000-0000-00000000bbbb'
const USER_MGR_LS   = 'u0000000-0000-0000-0000-00000000cccc'
const USER_KITCHEN  = 'u0000000-0000-0000-0000-00000000dddd'

const PLAN_STARTER = 'p0000000-0000-0000-0000-00000000aaaa'
const PLAN_PRO     = 'p0000000-0000-0000-0000-00000000bbbb'

const now = () => new Date().toISOString()

export const seed = {
  plans: [
    { id: PLAN_STARTER, code: 'starter', name: 'Starter', status: 'active' },
    { id: PLAN_PRO,     code: 'pro',     name: 'Pro',     status: 'active' },
  ],

  tenants: [
    {
      id: TENANT_LE_SPOT,
      name: 'Le Spot',
      slug: 'le-spot',
      status: 'active',
      plan_id: PLAN_PRO,
      created_at: '2025-01-12T10:00:00Z',
      updated_at: '2025-03-01T10:00:00Z',
    },
    {
      id: TENANT_OASIS,
      name: 'Oasis Healthy',
      slug: 'oasis-healthy',
      status: 'active',
      plan_id: PLAN_STARTER,
      created_at: '2025-02-20T10:00:00Z',
      updated_at: '2025-02-20T10:00:00Z',
    },
  ],

  restaurants: [
    {
      id: RESTO_LS_1, tenant_id: TENANT_LE_SPOT, name: 'Le Spot — Plateau',
      restaurant_type: 'restaurant', timezone: 'Africa/Abidjan', currency: 'XOF',
      address: 'Plateau, Abidjan', status: 'active',
      created_at: '2025-01-12T10:00:00Z', updated_at: '2025-01-12T10:00:00Z',
    },
    {
      id: RESTO_LS_2, tenant_id: TENANT_LE_SPOT, name: 'Le Spot — Cocody',
      restaurant_type: 'restaurant', timezone: 'Africa/Abidjan', currency: 'XOF',
      address: 'Cocody, Abidjan', status: 'active',
      created_at: '2025-01-15T10:00:00Z', updated_at: '2025-01-15T10:00:00Z',
    },
    {
      id: RESTO_OA_1, tenant_id: TENANT_OASIS, name: 'Oasis — Marcory',
      restaurant_type: 'dark_kitchen', timezone: 'Africa/Abidjan', currency: 'XOF',
      address: 'Marcory, Abidjan', status: 'active',
      created_at: '2025-02-20T10:00:00Z', updated_at: '2025-02-20T10:00:00Z',
    },
  ],

  users: [
    { id: USER_PLATFORM, email: 'admin@platform.io',  full_name: 'Platform Admin', status: 'active', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
    { id: USER_OWNER_LS, email: 'owner@le-spot.ci',   full_name: 'Awa Koné',       status: 'active', created_at: '2025-01-12T10:00:00Z', updated_at: '2025-01-12T10:00:00Z' },
    { id: USER_MGR_LS,   email: 'manager@le-spot.ci', full_name: 'Yao N\'Guessan', status: 'active', created_at: '2025-01-13T10:00:00Z', updated_at: '2025-01-13T10:00:00Z' },
    { id: USER_KITCHEN,  email: 'cuisine@le-spot.ci', full_name: 'Marie Diomandé', status: 'active', created_at: '2025-01-14T10:00:00Z', updated_at: '2025-01-14T10:00:00Z' },
  ],

  // Tenant memberships
  tenant_users: [
    { id: 'tu-1', tenant_id: TENANT_LE_SPOT, user_id: USER_OWNER_LS, role_code: 'tenant_owner', status: 'active', created_at: '2025-01-12T10:00:00Z' },
    { id: 'tu-2', tenant_id: TENANT_LE_SPOT, user_id: USER_MGR_LS,   role_code: 'manager',      status: 'active', created_at: '2025-01-13T10:00:00Z' },
    { id: 'tu-3', tenant_id: TENANT_LE_SPOT, user_id: USER_KITCHEN,  role_code: 'kitchen',      status: 'active', created_at: '2025-01-14T10:00:00Z' },
  ],

  // Restaurant-level access (refines tenant role per venue)
  restaurant_users: [
    { id: 'ru-1', tenant_id: TENANT_LE_SPOT, restaurant_id: RESTO_LS_1, user_id: USER_MGR_LS,   role_code: 'manager', status: 'active', created_at: '2025-01-13T10:00:00Z' },
    { id: 'ru-2', tenant_id: TENANT_LE_SPOT, restaurant_id: RESTO_LS_2, user_id: USER_KITCHEN,  role_code: 'kitchen', status: 'active', created_at: '2025-01-14T10:00:00Z' },
  ],

  tenant_entitlements: [
    { id: 'ent-1', tenant_id: TENANT_LE_SPOT, module_code: 'conversations', feature_code: null, enabled: true,  source: 'plan',     created_at: '2025-01-12T10:00:00Z', updated_at: '2025-01-12T10:00:00Z' },
    { id: 'ent-2', tenant_id: TENANT_LE_SPOT, module_code: 'customers',     feature_code: null, enabled: true,  source: 'plan',     created_at: '2025-01-12T10:00:00Z', updated_at: '2025-01-12T10:00:00Z' },
    { id: 'ent-3', tenant_id: TENANT_LE_SPOT, module_code: 'orders',        feature_code: null, enabled: true,  source: 'plan',     created_at: '2025-01-12T10:00:00Z', updated_at: '2025-01-12T10:00:00Z' },
    { id: 'ent-4', tenant_id: TENANT_LE_SPOT, module_code: 'reservations',  feature_code: null, enabled: true,  source: 'plan',     created_at: '2025-01-12T10:00:00Z', updated_at: '2025-01-12T10:00:00Z' },
    { id: 'ent-5', tenant_id: TENANT_LE_SPOT, module_code: 'catering',      feature_code: null, enabled: false, source: 'plan',     created_at: '2025-01-12T10:00:00Z', updated_at: '2025-01-12T10:00:00Z' },
    { id: 'ent-6', tenant_id: TENANT_LE_SPOT, module_code: 'healthy',       feature_code: null, enabled: false, source: 'plan',     created_at: '2025-01-12T10:00:00Z', updated_at: '2025-01-12T10:00:00Z' },
    { id: 'ent-7', tenant_id: TENANT_LE_SPOT, module_code: 'whatsapp',      feature_code: null, enabled: true,  source: 'override', created_at: '2025-01-12T10:00:00Z', updated_at: '2025-01-12T10:00:00Z' },

    { id: 'ent-8', tenant_id: TENANT_OASIS,   module_code: 'conversations', feature_code: null, enabled: true,  source: 'plan',     created_at: '2025-02-20T10:00:00Z', updated_at: '2025-02-20T10:00:00Z' },
    { id: 'ent-9', tenant_id: TENANT_OASIS,   module_code: 'healthy',       feature_code: null, enabled: true,  source: 'plan',     created_at: '2025-02-20T10:00:00Z', updated_at: '2025-02-20T10:00:00Z' },
  ],

  channels: [
    { id: 'ch-1', tenant_id: TENANT_LE_SPOT, restaurant_id: RESTO_LS_1, channel_type: 'whatsapp', provider: 'meta_cloud', external_channel_id: '+225XXXXXXXX', status: 'active',  created_at: '2025-01-15T10:00:00Z' },
    { id: 'ch-2', tenant_id: TENANT_LE_SPOT, restaurant_id: null,        channel_type: 'whatsapp', provider: 'meta_cloud', external_channel_id: '+225YYYYYYYY', status: 'pending', created_at: '2025-02-01T10:00:00Z' },
  ],

  audit_logs: [
    { id: 'al-1', tenant_id: TENANT_LE_SPOT, restaurant_id: null,        actor_type: 'user', actor_id: USER_OWNER_LS, entity_type: 'tenant',     entity_id: TENANT_LE_SPOT, action: 'tenant.created',          metadata: {}, created_at: '2025-01-12T10:00:00Z' },
    { id: 'al-2', tenant_id: TENANT_LE_SPOT, restaurant_id: RESTO_LS_1,  actor_type: 'user', actor_id: USER_OWNER_LS, entity_type: 'restaurant', entity_id: RESTO_LS_1,     action: 'restaurant.created',      metadata: {}, created_at: '2025-01-12T11:00:00Z' },
    { id: 'al-3', tenant_id: TENANT_LE_SPOT, restaurant_id: null,        actor_type: 'user', actor_id: USER_OWNER_LS, entity_type: 'tenant_user', entity_id: 'tu-2',        action: 'tenant_user.invited',     metadata: { role_code: 'manager' }, created_at: '2025-01-13T09:30:00Z' },
    { id: 'al-4', tenant_id: TENANT_LE_SPOT, restaurant_id: null,        actor_type: 'user', actor_id: USER_OWNER_LS, entity_type: 'entitlement', entity_id: 'ent-3',        action: 'entitlement.enabled',     metadata: { module_code: 'orders' }, created_at: '2025-01-15T10:00:00Z' },
    { id: 'al-5', tenant_id: TENANT_LE_SPOT, restaurant_id: RESTO_LS_1,  actor_type: 'system', actor_id: null,        entity_type: 'channel',    entity_id: 'ch-1',         action: 'channel.connected',       metadata: { provider: 'meta_cloud' }, created_at: '2025-01-15T10:30:00Z' },
  ],
}

// Exposed for quick access in special cases (e.g. "current user" picker)
export const ids = {
  TENANT_LE_SPOT, TENANT_OASIS,
  USER_PLATFORM, USER_OWNER_LS, USER_MGR_LS, USER_KITCHEN,
}
