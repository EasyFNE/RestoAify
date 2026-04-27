// Sidebar menu — SINGLE source of truth.
// Each item has a `status` controlling visibility/interactivity:
//   active   → fully implemented, navigates normally
//   reserved → route exists, renders ComingSoonPage; shown grey + "Bientôt" badge
//   hidden   → not rendered in sidebar
//
// Each item declares which scope it belongs to (`platform` | `tenant`)
// and which sidebar group it appears under. Roles/permissions are listed
// for future RBAC enforcement (07-security-access.md).

export const MENU = [
  // ── PLATFORM SCOPE ────────────────────────────────────────────────────
  {
    section: 'platform',
    title: 'Platform Admin',
    scope: 'platform',
    items: [
      { key: 'platform-dashboard', label: 'Dashboard',           path: '/platform',          status: 'active', roles: ['platform_admin', 'platform_support'] },
      { key: 'platform-tenants',   label: 'Tenants',             path: '/platform/tenants',  status: 'active', roles: ['platform_admin', 'platform_support'] },
      { key: 'platform-settings',  label: 'Paramètres plateforme', path: '/platform/settings', status: 'active', roles: ['platform_admin'] },
      { key: 'platform-audit',     label: 'Audit',               path: '/platform/audit',    status: 'active', roles: ['platform_admin', 'platform_support'] },
    ],
  },

  // ── TENANT SCOPE ──────────────────────────────────────────────────────
  {
    section: 'core',
    title: 'Core',
    scope: 'tenant',
    items: [
      { key: 'tenant-dashboard',     label: 'Dashboard',          path: '/app',                    status: 'active' },
      { key: 'tenant-info',          label: 'Mon tenant',         path: '/app/tenant',             status: 'active' },
      { key: 'tenant-restaurants',   label: 'Restaurants',        path: '/app/restaurants',        status: 'active' },
      { key: 'tenant-users',         label: 'Utilisateurs',       path: '/app/users',              status: 'active' },
      { key: 'tenant-restaurant-access', label: 'Accès par restaurant', path: '/app/restaurant-access', status: 'active' },
      { key: 'tenant-modules',       label: 'Modules',            path: '/app/modules',            status: 'active' },
      { key: 'tenant-settings',      label: 'Paramètres',         path: '/app/settings',           status: 'active' },
      { key: 'tenant-audit',         label: 'Audit',              path: '/app/audit',              status: 'active' },
    ],
  },

  // Reserved business modules — visible but disabled
  {
    section: 'operations',
    title: 'Operations',
    scope: 'tenant',
    items: [
      { key: 'mod-conversations', label: 'Conversations', path: '/app/conversations', status: 'reserved', module: 'conversations' },
      { key: 'mod-customers',     label: 'Clients',       path: '/app/customers',     status: 'reserved', module: 'customers' },
      { key: 'mod-orders',        label: 'Orders',        path: '/app/orders',        status: 'reserved', module: 'orders' },
      { key: 'mod-reservations',  label: 'Reservations',  path: '/app/reservations',  status: 'reserved', module: 'reservations' },
      { key: 'mod-catering',      label: 'Catering',      path: '/app/catering',      status: 'reserved', module: 'catering' },
      { key: 'mod-healthy',       label: 'Healthy',       path: '/app/healthy',       status: 'reserved', module: 'healthy' },
    ],
  },

  {
    section: 'integrations',
    title: 'Integrations',
    scope: 'tenant',
    items: [
      { key: 'int-channels',     label: 'Canaux',              path: '/app/channels',     status: 'reserved', module: 'channels' },
      { key: 'int-whatsapp',     label: 'WhatsApp Cloud API',  path: '/app/whatsapp',     status: 'reserved', module: 'whatsapp' },
      { key: 'int-integrations', label: 'Intégrations',        path: '/app/integrations', status: 'reserved', module: 'integrations' },
    ],
  },

  {
    section: 'billing',
    title: 'Future modules',
    scope: 'tenant',
    items: [
      { key: 'fut-billing', label: 'Abonnement & Facturation', path: '/app/billing', status: 'reserved', module: 'billing' },
    ],
  },
]

// Helper: filter the menu for a given scope and user role / entitlements.
// Hidden items are removed entirely; reserved items stay (rendered grey).
export function getMenuForScope(scope, { role, entitlements } = {}) {
  return MENU
    .filter(g => g.scope === scope)
    .map(g => ({
      ...g,
      items: g.items.filter(i => {
        if (i.status === 'hidden') return false
        if (i.roles && role && !i.roles.includes(role)) return false
        // Entitlement check is intentionally non-blocking for `reserved` items —
        // we want to show them so users see what's coming.
        return true
      }),
    }))
    .filter(g => g.items.length > 0)
}
