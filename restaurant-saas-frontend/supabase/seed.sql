-- =============================================================================
-- RestoAify — Seed de données factices
-- Correspond exactement à src/services/mockData.js
-- Usage : Supabase Dashboard → SQL Editor → coller ce script → Run
-- =============================================================================
-- ⚠️  CE SCRIPT SUPPOSE QUE LES TABLES EXISTENT DÉJÀ.
--     Si ce n'est pas encore le cas, crée d'abord les tables
--     puis exécute ce seed.
-- =============================================================================

-- Désactive temporairement les contraintes FK pour l'insertion dans l'ordre
SET session_replication_role = 'replica';

-- -----------------------------------------------------------------------------
-- 1. PLANS
-- -----------------------------------------------------------------------------
INSERT INTO plans (id, code, name, status) VALUES
  ('p0000000-0000-0000-0000-00000000aaaa', 'starter', 'Starter', 'active'),
  ('p0000000-0000-0000-0000-00000000bbbb', 'pro',     'Pro',     'active')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. TENANTS
-- -----------------------------------------------------------------------------
INSERT INTO tenants (id, name, slug, status, plan_id, created_at, updated_at) VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'Le Spot', 'le-spot', 'active',
    'p0000000-0000-0000-0000-00000000bbbb',
    '2025-01-12T10:00:00Z', '2025-03-01T10:00:00Z'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Oasis Healthy', 'oasis-healthy', 'active',
    'p0000000-0000-0000-0000-00000000aaaa',
    '2025-02-20T10:00:00Z', '2025-02-20T10:00:00Z'
  )
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. USERS (table publique — séparée de auth.users Supabase)
--    Note : si tu utilises Supabase Auth, ces users doivent aussi exister
--    dans auth.users avec le même UUID. Crée-les d'abord via l'Auth dashboard
--    ou via supabase.auth.admin.createUser(), puis insère ici.
-- -----------------------------------------------------------------------------
INSERT INTO users (id, email, full_name, status, created_at, updated_at) VALUES
  ('u0000000-0000-0000-0000-00000000aaaa', 'admin@platform.io',  'Platform Admin',  'active', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z'),
  ('u0000000-0000-0000-0000-00000000bbbb', 'owner@le-spot.ci',   'Awa Koné',        'active', '2025-01-12T10:00:00Z', '2025-01-12T10:00:00Z'),
  ('u0000000-0000-0000-0000-00000000cccc', 'manager@le-spot.ci', 'Yao N''Guessan',  'active', '2025-01-13T10:00:00Z', '2025-01-13T10:00:00Z'),
  ('u0000000-0000-0000-0000-00000000dddd', 'cuisine@le-spot.ci', 'Marie Diomandé',  'active', '2025-01-14T10:00:00Z', '2025-01-14T10:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. RESTAURANTS
-- -----------------------------------------------------------------------------
INSERT INTO restaurants (id, tenant_id, name, restaurant_type, timezone, currency, address, status, created_at, updated_at) VALUES
  (
    'a1111111-0000-0000-0000-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'Le Spot — Plateau', 'restaurant', 'Africa/Abidjan', 'XOF',
    'Plateau, Abidjan', 'active',
    '2025-01-12T10:00:00Z', '2025-01-12T10:00:00Z'
  ),
  (
    'a1111111-0000-0000-0000-000000000002',
    '11111111-1111-1111-1111-111111111111',
    'Le Spot — Cocody', 'restaurant', 'Africa/Abidjan', 'XOF',
    'Cocody, Abidjan', 'active',
    '2025-01-15T10:00:00Z', '2025-01-15T10:00:00Z'
  ),
  (
    'a2222222-0000-0000-0000-000000000001',
    '22222222-2222-2222-2222-222222222222',
    'Oasis — Marcory', 'dark_kitchen', 'Africa/Abidjan', 'XOF',
    'Marcory, Abidjan', 'active',
    '2025-02-20T10:00:00Z', '2025-02-20T10:00:00Z'
  )
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 5. TENANT_USERS (memberships)
-- -----------------------------------------------------------------------------
INSERT INTO tenant_users (id, tenant_id, user_id, role_code, status, created_at) VALUES
  ('tu-1', '11111111-1111-1111-1111-111111111111', 'u0000000-0000-0000-0000-00000000bbbb', 'tenant_owner', 'active', '2025-01-12T10:00:00Z'),
  ('tu-2', '11111111-1111-1111-1111-111111111111', 'u0000000-0000-0000-0000-00000000cccc', 'manager',      'active', '2025-01-13T10:00:00Z'),
  ('tu-3', '11111111-1111-1111-1111-111111111111', 'u0000000-0000-0000-0000-00000000dddd', 'kitchen',      'active', '2025-01-14T10:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 6. RESTAURANT_USERS (accès par restaurant)
-- -----------------------------------------------------------------------------
INSERT INTO restaurant_users (id, tenant_id, restaurant_id, user_id, role_code, status, created_at) VALUES
  ('ru-1', '11111111-1111-1111-1111-111111111111', 'a1111111-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-00000000cccc', 'manager', 'active', '2025-01-13T10:00:00Z'),
  ('ru-2', '11111111-1111-1111-1111-111111111111', 'a1111111-0000-0000-0000-000000000002', 'u0000000-0000-0000-0000-00000000dddd', 'kitchen', 'active', '2025-01-14T10:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 7. TENANT_ENTITLEMENTS (modules activés par tenant)
-- -----------------------------------------------------------------------------
INSERT INTO tenant_entitlements (id, tenant_id, module_code, feature_code, enabled, source, created_at, updated_at) VALUES
  -- Le Spot
  ('ent-1', '11111111-1111-1111-1111-111111111111', 'conversations', NULL, true,  'plan',     '2025-01-12T10:00:00Z', '2025-01-12T10:00:00Z'),
  ('ent-2', '11111111-1111-1111-1111-111111111111', 'customers',     NULL, true,  'plan',     '2025-01-12T10:00:00Z', '2025-01-12T10:00:00Z'),
  ('ent-3', '11111111-1111-1111-1111-111111111111', 'orders',        NULL, true,  'plan',     '2025-01-12T10:00:00Z', '2025-01-12T10:00:00Z'),
  ('ent-4', '11111111-1111-1111-1111-111111111111', 'reservations',  NULL, true,  'plan',     '2025-01-12T10:00:00Z', '2025-01-12T10:00:00Z'),
  ('ent-5', '11111111-1111-1111-1111-111111111111', 'catering',      NULL, false, 'plan',     '2025-01-12T10:00:00Z', '2025-01-12T10:00:00Z'),
  ('ent-6', '11111111-1111-1111-1111-111111111111', 'healthy',       NULL, false, 'plan',     '2025-01-12T10:00:00Z', '2025-01-12T10:00:00Z'),
  ('ent-7', '11111111-1111-1111-1111-111111111111', 'whatsapp',      NULL, true,  'override', '2025-01-12T10:00:00Z', '2025-01-12T10:00:00Z'),
  -- Oasis Healthy
  ('ent-8', '22222222-2222-2222-2222-222222222222', 'conversations', NULL, true,  'plan',     '2025-02-20T10:00:00Z', '2025-02-20T10:00:00Z'),
  ('ent-9', '22222222-2222-2222-2222-222222222222', 'healthy',       NULL, true,  'plan',     '2025-02-20T10:00:00Z', '2025-02-20T10:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 8. CHANNELS
-- -----------------------------------------------------------------------------
INSERT INTO channels (id, tenant_id, restaurant_id, channel_type, provider, external_channel_id, status, created_at) VALUES
  ('ch-1', '11111111-1111-1111-1111-111111111111', 'a1111111-0000-0000-0000-000000000001', 'whatsapp', 'meta_cloud', '+225XXXXXXXX', 'active',  '2025-01-15T10:00:00Z'),
  ('ch-2', '11111111-1111-1111-1111-111111111111', NULL,                                   'whatsapp', 'meta_cloud', '+225YYYYYYYY', 'pending', '2025-02-01T10:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 9. AUDIT_LOGS
-- -----------------------------------------------------------------------------
INSERT INTO audit_logs (id, tenant_id, restaurant_id, actor_type, actor_id, entity_type, entity_id, action, metadata, created_at) VALUES
  ('al-1', '11111111-1111-1111-1111-111111111111', NULL,                                   'user',   'u0000000-0000-0000-0000-00000000bbbb', 'tenant',      '11111111-1111-1111-1111-111111111111', 'tenant.created',      '{}',                           '2025-01-12T10:00:00Z'),
  ('al-2', '11111111-1111-1111-1111-111111111111', 'a1111111-0000-0000-0000-000000000001', 'user',   'u0000000-0000-0000-0000-00000000bbbb', 'restaurant',  'a1111111-0000-0000-0000-000000000001', 'restaurant.created',  '{}',                           '2025-01-12T11:00:00Z'),
  ('al-3', '11111111-1111-1111-1111-111111111111', NULL,                                   'user',   'u0000000-0000-0000-0000-00000000bbbb', 'tenant_user', 'tu-2',                                'tenant_user.invited', '{"role_code": "manager"}',     '2025-01-13T09:30:00Z'),
  ('al-4', '11111111-1111-1111-1111-111111111111', NULL,                                   'user',   'u0000000-0000-0000-0000-00000000bbbb', 'entitlement', 'ent-3',                               'entitlement.enabled', '{"module_code": "orders"}',    '2025-01-15T10:00:00Z'),
  ('al-5', '11111111-1111-1111-1111-111111111111', 'a1111111-0000-0000-0000-000000000001', 'system', NULL,                                  'channel',     'ch-1',                                'channel.connected',   '{"provider": "meta_cloud"}',  '2025-01-15T10:30:00Z')
ON CONFLICT (id) DO NOTHING;

-- Réactive les contraintes FK
SET session_replication_role = 'origin';

-- =============================================================================
-- FIN DU SEED
-- Vérifie avec :
--   SELECT COUNT(*) FROM plans;             -- 2
--   SELECT COUNT(*) FROM tenants;           -- 2
--   SELECT COUNT(*) FROM restaurants;       -- 3
--   SELECT COUNT(*) FROM users;             -- 4
--   SELECT COUNT(*) FROM tenant_users;      -- 3
--   SELECT COUNT(*) FROM restaurant_users;  -- 2
--   SELECT COUNT(*) FROM tenant_entitlements; -- 9
--   SELECT COUNT(*) FROM channels;          -- 2
--   SELECT COUNT(*) FROM audit_logs;        -- 5
-- =============================================================================
