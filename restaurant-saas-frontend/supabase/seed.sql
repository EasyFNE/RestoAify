-- =============================================================================
-- RestoAify — Seed de données factices
-- UUIDs : format hex strict uniquement (0-9, a-f)
-- Usage : Supabase Dashboard → SQL Editor → Run
-- =============================================================================

-- ETAPE 0 : OPTIONNEL — Voir les contraintes CHECK sur chaque table
-- Lance cette requête seule d'abord pour connaître les role_code autorisés :
--
-- SELECT cls.relname AS table_name, pg_get_constraintdef(pgc.oid) AS check_clause
-- FROM pg_constraint pgc
-- JOIN pg_class cls ON pgc.conrelid = cls.oid
-- WHERE cls.relname IN ('tenant_users', 'restaurant_users')
-- AND pgc.contype = 'c';

SET session_replication_role = 'replica';

-- -----------------------------------------------------------------------------
-- 1. PLANS
-- ON CONFLICT (code) pour éviter les doublons même si les IDs diffèrent
-- -----------------------------------------------------------------------------
INSERT INTO plans (id, code, name, status) VALUES
  ('00000000-0000-0000-0000-000000000001', 'starter', 'Starter', 'active'),
  ('00000000-0000-0000-0000-000000000002', 'pro',     'Pro',     'active')
ON CONFLICT (code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. TENANTS
-- plan_id résolu par sous-requête sur code (robuste peu importe l'UUID du plan)
-- -----------------------------------------------------------------------------
INSERT INTO tenants (id, name, slug, status, plan_id, created_at, updated_at) VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'Le Spot', 'le-spot', 'active',
    (SELECT id FROM plans WHERE code = 'pro'     LIMIT 1),
    '2025-01-12T10:00:00Z', '2025-03-01T10:00:00Z'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Oasis Healthy', 'oasis-healthy', 'active',
    (SELECT id FROM plans WHERE code = 'starter' LIMIT 1),
    '2025-02-20T10:00:00Z', '2025-02-20T10:00:00Z'
  )
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. USERS
-- Inclut les users de test + le vrai compte Supabase Auth du développeur
-- ⚠️  Remplace l'UUID et l'email ci-dessous par les tiens si besoin
-- -----------------------------------------------------------------------------
INSERT INTO users (id, email, full_name, status, created_at, updated_at) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin@platform.io',    'Platform Admin', 'active', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'owner@le-spot.ci',     'Awa Koné',       'active', '2025-01-12T10:00:00Z', '2025-01-12T10:00:00Z'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'manager@le-spot.ci',   'Yao N''Guessan', 'active', '2025-01-13T10:00:00Z', '2025-01-13T10:00:00Z'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'cuisine@le-spot.ci',   'Marie Diomandé', 'active', '2025-01-14T10:00:00Z', '2025-01-14T10:00:00Z'),
  -- Compte réel du développeur (UID = UUID Supabase Auth)
  ('b3a40529-af4a-4131-8699-c7f1682a98a7', 'yattarayman@gmail.com', 'Ayman Yattara', 'active', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. RESTAURANTS
-- -----------------------------------------------------------------------------
INSERT INTO restaurants (id, tenant_id, name, restaurant_type, timezone, currency, address, status, created_at, updated_at) VALUES
  (
    'bbbbbbbb-0000-0000-0000-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'Le Spot — Plateau', 'restaurant', 'Africa/Abidjan', 'XOF',
    'Plateau, Abidjan', 'active',
    '2025-01-12T10:00:00Z', '2025-01-12T10:00:00Z'
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000002',
    '11111111-1111-1111-1111-111111111111',
    'Le Spot — Cocody', 'restaurant', 'Africa/Abidjan', 'XOF',
    'Cocody, Abidjan', 'active',
    '2025-01-15T10:00:00Z', '2025-01-15T10:00:00Z'
  ),
  (
    'cccccccc-0000-0000-0000-000000000001',
    '22222222-2222-2222-2222-222222222222',
    'Oasis — Marcory', 'dark_kitchen', 'Africa/Abidjan', 'XOF',
    'Marcory, Abidjan', 'active',
    '2025-02-20T10:00:00Z', '2025-02-20T10:00:00Z'
  )
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 5. TENANT_USERS
-- ✅ role_code corrigés : 'tenant_owner' au lieu de 'owner'
--    Valeurs valides : tenant_owner | tenant_admin | manager | staff | kitchen
-- -----------------------------------------------------------------------------
INSERT INTO tenant_users (id, tenant_id, user_id, role_code, status, created_at) VALUES
  ('dddddddd-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000002', 'tenant_owner', 'active', '2025-01-12T10:00:00Z'),
  ('dddddddd-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000003', 'manager',      'active', '2025-01-13T10:00:00Z'),
  ('dddddddd-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000004', 'kitchen',      'active', '2025-01-14T10:00:00Z'),
  -- Compte réel du développeur → tenant_owner sur Le Spot
  (gen_random_uuid(),                      '11111111-1111-1111-1111-111111111111', 'b3a40529-af4a-4131-8699-c7f1682a98a7', 'tenant_owner', 'active', NOW())
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 6. RESTAURANT_USERS
-- -----------------------------------------------------------------------------
INSERT INTO restaurant_users (id, tenant_id, restaurant_id, user_id, role_code, status, created_at) VALUES
  ('eeeeeeee-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003', 'manager', 'active', '2025-01-13T10:00:00Z'),
  ('eeeeeeee-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000004', 'kitchen', 'active', '2025-01-14T10:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 7. TENANT_ENTITLEMENTS
-- -----------------------------------------------------------------------------
INSERT INTO tenant_entitlements (id, tenant_id, module_code, feature_code, enabled, source, created_at, updated_at) VALUES
  ('ffffffff-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'conversations', NULL, true,  'plan',     '2025-01-12T10:00:00Z', '2025-01-12T10:00:00Z'),
  ('ffffffff-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'contacts',      NULL, true,  'plan',     '2025-01-12T10:00:00Z', '2025-01-12T10:00:00Z'),
  ('ffffffff-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'orders',        NULL, true,  'plan',     '2025-01-12T10:00:00Z', '2025-01-12T10:00:00Z'),
  ('ffffffff-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'reservations',  NULL, true,  'plan',     '2025-01-12T10:00:00Z', '2025-01-12T10:00:00Z'),
  ('ffffffff-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'catering',      NULL, false, 'plan',     '2025-01-12T10:00:00Z', '2025-01-12T10:00:00Z'),
  ('ffffffff-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'healthy',       NULL, false, 'plan',     '2025-01-12T10:00:00Z', '2025-01-12T10:00:00Z'),
  ('ffffffff-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'handoff',       NULL, true,  'override', '2025-01-12T10:00:00Z', '2025-01-12T10:00:00Z'),
  ('ffffffff-0000-0000-0000-000000000008', '22222222-2222-2222-2222-222222222222', 'conversations', NULL, true,  'plan',     '2025-02-20T10:00:00Z', '2025-02-20T10:00:00Z'),
  ('ffffffff-0000-0000-0000-000000000009', '22222222-2222-2222-2222-222222222222', 'healthy',       NULL, true,  'plan',     '2025-02-20T10:00:00Z', '2025-02-20T10:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 8. CHANNELS
-- -----------------------------------------------------------------------------
INSERT INTO channels (id, tenant_id, restaurant_id, channel_type, provider, external_channel_id, status, created_at) VALUES
  ('11111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000001', 'whatsapp', 'meta_cloud', '+225XXXXXXXX', 'active',  '2025-01-15T10:00:00Z'),
  ('11111111-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', NULL,                                   'whatsapp', 'meta_cloud', '+225YYYYYYYY', 'pending', '2025-02-01T10:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 9. AUDIT_LOGS
-- -----------------------------------------------------------------------------
INSERT INTO audit_logs (id, tenant_id, restaurant_id, actor_type, actor_id, entity_type, entity_id, action, metadata, created_at) VALUES
  ('22222222-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', NULL,                                   'user',   'aaaaaaaa-0000-0000-0000-000000000002', 'tenant',      '11111111-1111-1111-1111-111111111111', 'tenant.created',      '{}',                          '2025-01-12T10:00:00Z'),
  ('22222222-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000001', 'user',   'aaaaaaaa-0000-0000-0000-000000000002', 'restaurant',  'bbbbbbbb-0000-0000-0000-000000000001', 'restaurant.created',  '{}',                          '2025-01-12T11:00:00Z'),
  ('22222222-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', NULL,                                   'user',   'aaaaaaaa-0000-0000-0000-000000000002', 'tenant_user', 'dddddddd-0000-0000-0000-000000000002', 'tenant_user.invited', '{"role_code": "manager"}',    '2025-01-13T09:30:00Z'),
  ('22222222-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', NULL,                                   'user',   'aaaaaaaa-0000-0000-0000-000000000002', 'entitlement', 'ffffffff-0000-0000-0000-000000000003', 'entitlement.enabled', '{"module_code": "orders"}',   '2025-01-15T10:00:00Z'),
  ('22222222-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000001', 'system', NULL,                                  'channel',     '11111111-0000-0000-0000-000000000001', 'channel.connected',   '{"provider": "meta_cloud"}',  '2025-01-15T10:30:00Z')
ON CONFLICT (id) DO NOTHING;

SET session_replication_role = 'origin';

-- =============================================================================
-- Vérifications :
--   SELECT COUNT(*) FROM plans;               -- ≥ 2
--   SELECT COUNT(*) FROM tenants;             -- 2
--   SELECT COUNT(*) FROM restaurants;         -- 3
--   SELECT COUNT(*) FROM users;               -- 5 (4 tests + 1 réel)
--   SELECT COUNT(*) FROM tenant_users;        -- 4 (3 tests + 1 réel)
--   SELECT COUNT(*) FROM restaurant_users;    -- 2
--   SELECT COUNT(*) FROM tenant_entitlements; -- 9
--   SELECT COUNT(*) FROM channels;            -- 2
--   SELECT COUNT(*) FROM audit_logs;          -- 5
-- =============================================================================
