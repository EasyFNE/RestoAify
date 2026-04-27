// Lightweight frontend feature flags. Resolved at runtime so they can later
// come from an env var, a remote config, or per-tenant entitlements.
//
// Keep this file minimal: heavy feature management lives server-side in
// tenant_entitlements (doc 02) — this is just to gate frontend pieces.

const DEFAULT_FLAGS = {
  // Show a banner on dashboards explaining v1 status
  showV1Banner: true,
  // Allow toggling entitlements from the UI (Modules page)
  enableEntitlementToggle: true,
  // Allow creating new tenants from Platform Admin (mock mode only)
  allowCreateTenant: true,
}

export function isFeatureEnabled(flag) {
  // Override via env: VITE_FF_<FLAG>=true|false
  const envKey = `VITE_FF_${flag.toUpperCase()}`
  const envVal = import.meta.env[envKey]
  if (envVal === 'true') return true
  if (envVal === 'false') return false
  return DEFAULT_FLAGS[flag] ?? false
}
