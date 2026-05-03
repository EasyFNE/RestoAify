// Module registry — frontend-side mirror of the logical registry described in
// 01-multi-tenant-architecture.md and the activable list in 02-data-model.md.
//
// IMPORTANT — module_code values MUST match the DB CHECK constraint on
// tenant_entitlements.module_code (doc 02) :
// {orders, reservations, catering, healthy, contacts, menus, handoff,
// healthy_subscriptions}
//
// The codes channels / whatsapp / integrations / billing referenced elsewhere
// in the UI (menu, ComingSoonPage) are NOT activable yet — they will be added
// when their backend tables and CHECK extension land via a dedicated migration.
//
// Used by:
// - ModulesPage (activation state, plan-aware UI)
// - TenantContext.isModuleEnabled(code)
//
// The `plans` field is purely documentary on the frontend — the source of
// truth for "what's included in which plan" is the SQL table plan_modules.

export const MODULES = [
  // ── Core ────────────────────────────────────────────────────────────────
  // Pillars of the conversational + catalog experience.
  // Included in every commercial plan; not togglable from the tenant UI.
  {
    code: 'contacts',
    name: 'Contacts',
    state: 'GA',
    category: 'core',
    availableForActivation: false,
    description: 'Base unifiée des contacts par tenant',
    plans: ['starter', 'pro', 'enterprise'],
  },
  {
    code: 'menus',
    name: 'Menus',
    state: 'GA',
    category: 'core',
    availableForActivation: true,
    description: 'Catalogue produit du restaurant (cartes, items, prix)',
    plans: ['starter', 'pro', 'enterprise'],
  },
  {
    code: 'handoff',
    name: 'Handoff humain',
    state: 'GA',
    category: 'core',
    availableForActivation: false,
    description: 'Bascule vers un humain depuis une conversation IA',
    plans: ['starter', 'pro', 'enterprise'],
  },

  // ── Business ────────────────────────────────────────────────────────────
  // Activable / désactivable selon le plan et l'usage métier du tenant.
  {
    code: 'orders',
    name: 'Orders',
    state: 'beta',
    category: 'business',
    availableForActivation: true,
    description: 'Commandes (sur place, à emporter, livraison)',
    plans: ['starter', 'pro', 'enterprise'],
  },
  {
    code: 'reservations',
    name: 'Reservations',
    state: 'beta',
    category: 'business',
    availableForActivation: true,
    description: 'Réservations de tables et événements',
    plans: ['pro', 'enterprise'],
  },
  {
    code: 'catering',
    name: 'Catering',
    state: 'alpha',
    category: 'business',
    availableForActivation: true,
    description: 'Demandes de traiteur et offres groupées',
    plans: ['enterprise'],
  },
  {
    code: 'healthy',
    name: 'Healthy',
    state: 'alpha',
    category: 'business',
    availableForActivation: true,
    description: 'Programmes Healthy / repas équilibrés',
    plans: ['enterprise'],
  },
  {
    code: 'healthy_subscriptions',
    name: 'Healthy Subscriptions',
    state: 'alpha',
    category: 'business',
    availableForActivation: true,
    description: 'Abonnements diététiques récurrents',
    plans: ['enterprise'],
  },

  // ── Integrations / Billing ─────────────────────────────────────────────
  // Not yet wired (CHECK extension pending). Placeholder categories kept so
  // the UI groups stay stable when codes are added.
]

// Logical group order for the Modules page UI.
export const MODULE_CATEGORIES = ['core', 'business', 'integrations', 'billing']

export const MODULE_CATEGORY_LABELS = {
  core:         'Modules essentiels',
  business:     'Modules métier',
  integrations: 'Intégrations',
  billing:      'Facturation',
}

export function getModule(code) {
  return MODULES.find(m => m.code === code)
}

export function getModulesByCategory(category) {
  return MODULES.filter(m => m.category === category)
}
