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
// FIX: ajout de `isResolved` pour indiquer que le contexte a terminé
// sa phase d'initialisation. Les pages doivent attendre isResolved=true
// avant de lancer un fetch, pour éviter de déclencher le guard
// "!currentTenantId → setLoading(false)" trop tôt au premier render.
//
// FIX #2: timeout de sécurité (8s) — si currentUser reste null trop longtemps
// (session expirée, refresh token lent, erreur réseau), on force isResolved=true
// pour débloquer les pages plutôt que de rester en écran blanc indéfiniment.

const TenantContext = createContext(null)

// Durée max d'attente avant de forcer isResolved=true même sans currentUser.
const RESOLVE_TIMEOUT_MS = 8_000

export function TenantProvider({ children }) {
  const { currentUser } = useAuthContext()
  const [currentTenantId, setCurrentTenantId] = useState(null)
  const [currentTenant, setCurrentTenant] = useState(null)
  const [entitlements, setEntitlements] = useState([])
  const [tenantLoading, setTenantLoading] = useState(false)
  const [tenantError, setTenantError] = useState(null)
  // isResolved : devient true dès que le premier cycle d'initialisation
  // du tenant est terminé (qu'un tenant soit trouvé ou non).
  const [isResolved, setIsResolved] = useState(false)

  // Ref pour annuler le timeout si currentUser se résout dans les temps.
  const resolveTimerRef = useRef(null)

  // ── Timeout de sécurité : si currentUser reste null après RESOLVE_TIMEOUT_MS,
  // on force isResolved=true pour débloquer les pages (écran blanc).
  useEffect(() => {
    if (currentUser) {
      // currentUser est là — annuler le timer de sécurité s'il tourne encore.
      if (resolveTimerRef.current) {
        clearTimeout(resolveTimerRef.current)
        resolveTimerRef.current = null
      }
      return
    }
    // currentUser est null : on lance le timer de sécurité.
    resolveTimerRef.current = setTimeout(() => {
      console.warn(
        `[TenantContext] currentUser toujours null après ${RESOLVE_TIMEOUT_MS}ms` +
        ' — forçage isResolved=true pour débloquer les pages.'
      )
      setIsResolved(true)
    }, RESOLVE_TIMEOUT_MS)

    return () => {
      if (resolveTimerRef.current) {
        clearTimeout(resolveTimerRef.current)
        resolveTimerRef.current = null
      }
    }
  }, [currentUser])

  useEffect(() => {
    if (!currentUser) {
      setCurrentTenantId(null)
      // Pas encore résolu si pas d'user — on attend que currentUser soit défini
      // (ou que le timeout de sécurité se déclenche).
      setIsResolved(false)
      return
    }
    if (currentUser.scope === 'tenant') {
      setCurrentTenantId(currentUser.tenantId)
    } else {
      // platform user : pas de tenant fixe, mais le contexte est prêt.
      setCurrentTenantId(null)
      setIsResolved(true)
    }
  }, [currentUser])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!currentTenantId) {
        setCurrentTenant(null)
        setEntitlements([])
        setTenantError(null)
        // Si currentUser est défini mais tenantId est null, le contexte
        // est quand même résolu (tenant introuvable ou platform user).
        if (currentUser) setIsResolved(true)
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
  }, [currentTenantId, currentUser])

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
      isResolved: false,
      setCurrentTenantId: () => {},
      isModuleEnabled: () => false,
    }
  }
  return ctx
}
