import { createContext, useContext, useEffect, useState } from 'react'
import { useAuthContext } from './AuthContext.jsx'
import { api } from '../services/api.js'

// TenantContext — expose le tenant actif pour les pages tenant-scoped.
//
// - user tenant  : currentTenantId fixé depuis user.tenantId
// - user platform: currentTenantId sélectionnable (support / impersonation)
//
// RÈGLE multi-tenant (doc 01) : toujours passer currentTenantId aux appels API.

const TenantContext = createContext(null)

export function TenantProvider({ children }) {
  const { currentUser } = useAuthContext()
  const [currentTenantId, setCurrentTenantId] = useState(null)
  const [currentTenant, setCurrentTenant] = useState(null)
  const [entitlements, setEntitlements] = useState([])
  const [tenantLoading, setTenantLoading] = useState(false)
  const [tenantError, setTenantError] = useState(null)

  useEffect(() => {
    if (!currentUser) {
      setCurrentTenantId(null)
      return
    }
    if (currentUser.scope === 'tenant') {
      setCurrentTenantId(currentUser.tenantId)
    }
  }, [currentUser])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!currentTenantId) {
        setCurrentTenant(null)
        setEntitlements([])
        setTenantError(null)
        return
      }
      setTenantLoading(true)
      setTenantError(null)
      try {
        const [t, ents] = await Promise.all([
          api.getTenant(currentTenantId),
          api.listEntitlements(currentTenantId),
        ])
        if (cancelled) return
        setCurrentTenant(t)
        setEntitlements(Array.isArray(ents) ? ents : [])
      } catch (err) {
        if (!cancelled) {
          console.error('[TenantContext] load error:', err)
          setTenantError(err?.message || 'Erreur lors du chargement du tenant.')
        }
      } finally {
        if (!cancelled) setTenantLoading(false)
      }
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
        tenantLoading,
        tenantError,
        setCurrentTenantId,
        isModuleEnabled,
      }}
    >
      {children}
    </TenantContext.Provider>
  )
}

// FIX #2 : retour safe au lieu de throw si hors Provider
// Évite les pages blanches si un composant est rendu hors TenantProvider.
export function useTenantContext() {
  const ctx = useContext(TenantContext)
  if (!ctx) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('useTenantContext appelé hors TenantProvider — valeurs par défaut retournées.')
    }
    return {
      currentTenantId: null,
      currentTenant: null,
      entitlements: [],
      tenantLoading: false,
      tenantError: null,
      setCurrentTenantId: () => {},
      isModuleEnabled: () => false,
    }
  }
  return ctx
}
