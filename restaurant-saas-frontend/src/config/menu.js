// Sidebar menu — SINGLE source of truth.
//
// status:
//   active   → fully implemented, navigates normally
//   reserved → route exists, renders ComingSoonPage. Visuellement identique
//              à un item actif (plus de badge « Bientôt »). Le statut est
//              conservé pour la sémantique interne et l’activation future.
//   hidden   → not rendered in sidebar
//
// scope: 'platform' | 'tenant'
// roles: optional allowlist (future RBAC — 07-security-access.md)

export const MENU = [
  // ── PLATFORM SCOPE ──────────────────────────────────────────────
  {
    section: 'platform',
    title: 'Platform Admin',
    scope: 'platform',
    items: [
      { key: 'platform-dashboard', label: 'Dashboard',             path: '/platform',          status: 'active',   roles: ['platform_admin', 'platform_support'] },
      { key: 'platform-tenants',   label: 'Tenants',               path: '/platform/tenants',  status: 'active',   roles: ['platform_admin', 'platform_support'] },
      { key: 'platform-settings',  label: 'Paramètres plateforme', path: '/platform/settings', status: 'active',   roles: ['platform_admin'] },
      { key: 'platform-audit',     label: 'Audit',                 path: '/platform/audit',    status: 'active',   roles: ['platform_admin', 'platform_support'] },
    ],
  },

  // ── TENANT SCOPE ──────────────────────────────────────────────

  // PRINCIPALE (ex-CORE)
  {
    section: 'principale',
    title: 'Principale',
    scope: 'tenant',
    items: [
      { key: 'tenant-dashboard',    label: 'Dashboard',    path: '/app',           status: 'active' },
      { key: 'tenant-info',         label: 'Mon tenant',   path: '/app/tenant',    status: 'active' },
      { key: 'tenant-restaurants',  label: 'Restaurants',  path: '/app/restaurants', status: 'active' },
      { key: 'tenant-audit',        label: 'Audit',        path: '/app/audit',     status: 'active' },
    ],
  },

  // MODULES (ex-OPERATIONS) — modules métier + page d’activation des modules
  {
    section: 'modules',
    title: 'Modules',
    scope: 'tenant',
    items: [
      { key: 'mod-conversations',  label: 'Conversations', path: '/app/conversations', status: 'reserved', module: 'conversations' },
      { key: 'mod-customers',      label: 'Clients',       path: '/app/customers',      status: 'reserved', module: 'customers' },
      { key: 'mod-orders',         label: 'Commandes',     path: '/app/orders',         status: 'reserved', module: 'orders' },
      { key: 'mod-reservations',   label: 'Réservations',  path: '/app/reservations',   status: 'reserved', module: 'reservations' },
      { key: 'mod-catering',       label: 'Traiteur',      path: '/app/catering',       status: 'reserved', module: 'catering' },
      { key: 'mod-healthy',        label: 'Healthy',       path: '/app/healthy',        status: 'reserved', module: 'healthy' },
      { key: 'tenant-modules',     label: 'Modules',       path: '/app/modules',        status: 'active' },
    ],
  },

  // INTEGRATIONS
  {
    section: 'integrations',
    title: 'Intégrations',
    scope: 'tenant',
    items: [
      { key: 'int-channels',      label: 'Canaux',        path: '/app/channels',      status: 'reserved', module: 'channels' },
      { key: 'int-whatsapp',      label: 'WhatsApp',      path: '/app/whatsapp',      status: 'reserved', module: 'whatsapp' },
      { key: 'int-integrations',  label: 'Intégrations',  path: '/app/integrations',  status: 'reserved', module: 'integrations' },
    ],
  },

  // PARAMETRES
  {
    section: 'parametres',
    title: 'Paramètres',
    scope: 'tenant',
    items: [
      { key: 'tenant-users',             label: 'Utilisateurs',             path: '/app/users',             status: 'active' },
      { key: 'tenant-restaurant-access', label: 'Accès par restaurant',     path: '/app/restaurant-access', status: 'active' },
      { key: 'fut-billing',              label: 'Abonnement & Facturation',  path: '/app/billing',           status: 'reserved', module: 'billing' },
      { key: 'tenant-settings',          label: 'Paramètres généraux',      path: '/app/settings',          status: 'active' },
    ],
  },
]

// Helper : filtre le menu pour un scope et un rôle donnés.
// Les items hidden sont supprimés ; les items reserved restent (visuellement
// identiques aux items actifs — plus de badge « Bientôt »).
export function getMenuForScope(scope, { role, entitlements } = {}) {
  return MENU
    .filter(g => g.scope === scope)
    .map(g => ({
      ...g,
      items: g.items.filter(i => {
        if (i.status === 'hidden') return false
        if (i.roles && role && !i.roles.includes(role)) return false
        // Entitlement check is intentionally non-blocking for reserved items —
        // on les montre pour que les utilisateurs voient toute la surface produit.
        return true
      }),
    }))
    .filter(g => g.items.length > 0)
}
