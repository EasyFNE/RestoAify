// Module registry — mirrors the logical registry described in
// 01-multi-tenant-architecture.md. Used to:
//   - display module activation state in the Modules page
//   - check entitlements before exposing a feature
//
// Keep `code` aligned with `tenant_entitlements.module_code` from doc 02.

export const MODULES = [
  // Core modules (always implicitly active for the platform; entitlements may vary)
  { code: 'conversations', name: 'Conversations', state: 'GA',    category: 'core',         availableForActivation: false, description: 'Conversations entrantes (WhatsApp, etc.)' },
  { code: 'customers',     name: 'Clients',       state: 'GA',    category: 'core',         availableForActivation: false, description: 'Base unifiée des contacts par tenant' },

  // Business modules v1 — reserved in v1 frontend
  { code: 'orders',        name: 'Orders',        state: 'beta',  category: 'business',     availableForActivation: true,  description: 'Commandes (sur place, à emporter, livraison)' },
  { code: 'reservations',  name: 'Reservations',  state: 'beta',  category: 'business',     availableForActivation: true,  description: 'Réservations de tables et événements' },
  { code: 'catering',      name: 'Catering',      state: 'alpha', category: 'business',     availableForActivation: true,  description: 'Demandes de traiteur et offres groupées' },
  { code: 'healthy',       name: 'Healthy',       state: 'alpha', category: 'business',     availableForActivation: true,  description: 'Programmes Healthy / abonnements diététiques' },

  // Integrations — reserved
  { code: 'channels',      name: 'Canaux',                 state: 'beta',  category: 'integrations', availableForActivation: true, description: 'Configuration des canaux entrants' },
  { code: 'whatsapp',      name: 'WhatsApp Cloud API',     state: 'beta',  category: 'integrations', availableForActivation: true, description: 'Intégration WhatsApp Cloud API + Embedded Signup' },
  { code: 'integrations',  name: 'Intégrations',           state: 'alpha', category: 'integrations', availableForActivation: true, description: 'Connecteurs externes (POS, paiement, etc.)' },

  // Billing — reserved
  { code: 'billing',       name: 'Abonnement & Facturation', state: 'alpha', category: 'billing',   availableForActivation: false, description: 'Plan SaaS, factures, paiements mensuels' },
]

export function getModule(code) {
  return MODULES.find(m => m.code === code)
}
