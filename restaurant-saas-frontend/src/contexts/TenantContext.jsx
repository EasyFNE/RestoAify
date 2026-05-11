import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useAuthContext } from './AuthContext.jsx'
import { api } from '../services/api.js'

// TenantContext — expose le tenant actif pour les pages tenant-scoped.
//
// - user tenant  : currentTenantId fixé depuis user.tenantId
// - user platform: currentTenantId sélectionnable (support / impersonation)
//
// RÈGLE multi-tenant (doc 01) : toujours passer currentTenantId aux appels API.
//
// FIX: consomme `authLoading` depuis AuthContext pour ne pas démarrer
// le cycle d'initialisation du tenant avant que Supabase ait rendu
// son verdict sur la session courante. Cela supprime le besoin du
// timer de sécurité de 8s qui était la cause principale des pages
// blanches sur les modules Conversations et Clients.

const TenantContext = createContext(null)

export function TenantProvider({ children }) {
  const { currentUser, authLoading } = useAuthContext()
  const [currentTenantId, setCurrentTenantId] = useState(null)
  const [currentTenant, setCurrentTenant] = useState(null)
  const [entitlements, setEntitlements] = useState([])
  const [tenantLoading, setTenantLoading] = useState(false)
  const [tenantError, setTenantError] = useState(null)
  // isResolved : devient true dès que le premier cycle d'initialisation
  // du tenant est terminé (qu'un tenant soit trouvé ou non).
  const [isResolved, setIsResolved] = useState(false)

  // ── Synchronisation tenantId depuis currentUser
  // On attend que authLoading soit false avant de prendre une décision,
  // pour éviter de traiter un currentUser=null transitoire comme une
  // vraie absence de session.
  useEffect(() => {
    if (authLoading) {
      // Supabase n'a pas encore rendu son verdict — on ne touche à rien.
      return
    }
    if (!currentUser) {
      setCurrentTenantId(null)
      setIsResolved(true)  // Pas de session → résolu immédiatement
      return
    }
    if (currentUser.scope === 'tenant') {
      setCurrentTenantId(currentUser.tenantId)
    } else {
      // platform user : pas de tenant fixe, mais le contexte est prêt.
      setCurrentTenantId(null)
      setIsResolved(true)
    }
  }, [currentUser, authLoading])

  // ── Chargement du tenant et de ses entitlements
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!currentTenantId) {
        setCurrentTenant(null)
        setEntitlements([])
        setTenantError(null)
        // Si currentUser est défini mais tenantId est null, le contexte
        // est quand même résolu (tenant introuvable ou platform user).
        if (currentUser && !authLoading) setIsResolved(true)
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
        if (!cancelled) {
          setTenantLoading(false)
          setIsResolved(true)
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [currentTenantId, currentUser, authLoading])

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
        isResolved,
        setCurrentTenantId,
        isModuleEnabled,
      }}
    >
      {children}
    </TenantContext.Provider>
  )
}

// FIX : retour safe au lieu de throw si hors Provider
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
      isResolved: false,
      setCurrentTenantId: () => {},
      isModuleEnabled: () => false,
    }
  }
  return ctx
}
