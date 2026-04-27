import { createContext, useContext, useEffect, useState } from 'react'
import { useAuthContext } from './AuthContext.jsx'
import { api } from '../services/api.js'

// TenantContext exposes the *currently active* tenant for tenant-scoped pages.
//
// Two cases:
//   - tenant user: the tenant is fixed (their membership). currentTenantId
//                  is forced to user.tenantId.
//   - platform user: currentTenantId is selectable (e.g. via topbar / URL),
//                    used when impersonating a tenant for support.
//
// IMPORTANT (multi-tenant rule from doc 01): when calling APIs from tenant
// pages, ALWAYS pass currentTenantId. Components must never call
// api.listRestaurants() without a tenantId.

const TenantContext = createContext(null)

export function TenantProvider({ children }) {
  const { currentUser } = useAuthContext()
  const [currentTenantId, setCurrentTenantId] = useState(null)
  const [currentTenant, setCurrentTenant] = useState(null)
  const [entitlements, setEntitlements] = useState([])

  // Initialize tenant id from logged user
  useEffect(() => {
    if (!currentUser) {
      setCurrentTenantId(null)
      return
    }
    if (currentUser.scope === 'tenant') {
      setCurrentTenantId(currentUser.tenantId)
    }
    // platform users start with no tenant; they pick one when navigating
  }, [currentUser])

  // Load tenant + entitlements when id changes
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!currentTenantId) {
        setCurrentTenant(null)
        setEntitlements([])
        return
      }
      const [t, ents] = await Promise.all([
        api.getTenant(currentTenantId),
        api.listEntitlements(currentTenantId),
      ])
      if (cancelled) return
      setCurrentTenant(t)
      setEntitlements(ents)
    }
    load()
    return () => { cancelled = true }
  }, [currentTenantId])

  function isModuleEnabled(moduleCode) {
    return entitlements.some(e => e.module_code === moduleCode && e.enabled)
  }

  return (
    <TenantContext.Provider
      value={{
        currentTenantId,
        currentTenant,
        entitlements,
        setCurrentTenantId,
        isModuleEnabled,
      }}
    >
      {children}
    </TenantContext.Provider>
  )
}

export function useTenantContext() {
  const ctx = useContext(TenantContext)
  if (!ctx) throw new Error('useTenantContext must be used within TenantProvider')
  return ctx
}
