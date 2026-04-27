import { useTenantContext } from '../contexts/TenantContext.jsx'

export function useTenant() {
  return useTenantContext()
}
