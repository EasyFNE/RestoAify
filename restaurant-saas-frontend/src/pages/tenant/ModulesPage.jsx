import { useEffect, useState, useCallback } from 'react'
import PageHeader from '../../components/PageHeader.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { api } from '../../services/api.js'
import { useTenant } from '../../hooks/useTenant.js'
import { useFeatureFlag } from '../../hooks/useFeatureFlag.js'
import {
  MODULES,
  MODULE_CATEGORIES,
  MODULE_CATEGORY_LABELS,
} from '../../config/modules.js'
import { cn } from '../../lib/cn.js'

// ─────────────────────────────────────────────────────────────────────────────
// Source badge colors — aligned with doc 02 (source ∈ {plan, override, beta, admin})
// ─────────────────────────────────────────────────────────────────────────────
const SOURCE_BADGE = {
  plan:     { label: 'Plan',     cls: 'bg-blue-100 text-blue-700' },
  override: { label: 'Override', cls: 'bg-amber-100 text-amber-800' },
  admin:    { label: 'Admin',    cls: 'bg-red-100 text-red-700' },
  beta:     { label: 'Beta',     cls: 'bg-violet-100 text-violet-700' },
}

export default function ModulesPage() {
  const { currentTenant, currentTenantId } = useTenant()
  const canToggle = useFeatureFlag('enableEntitlementToggle')

  const [ents, setEnts]           = useState([])
  const [planModules, setPlanModules] = useState([])
  const [loading, setLoading]     = useState(true)
  const [busy, setBusy]           = useState(null)
  const [error, setError]         = useState(null)

  // ── Loaders ───────────────────────────────────────────────────────────────
  const loadEntitlements = useCallback(async () => {
    if (!currentTenantId) return
    const fresh = await api.listEntitlements(currentTenantId)
    setEnts(fresh)
  }, [currentTenantId])

  const loadPlanModules = useCallback(async () => {
    if (!currentTenant?.plan_id) {
      setPlanModules([])
      return
    }
    try {
      const fresh = await api.listPlanModules(currentTenant.plan_id)
      setPlanModules(fresh)
    } catch {
      // Non-blocking : si la table plan_modules n'existe pas encore en local,
      // on continue avec une liste vide (mode dégradé).
      setPlanModules([])
    }
  }, [currentTenant?.plan_id])

  useEffect(() => {
    if (!currentTenantId) return
    let cancelled = false
    setLoading(true)
    Promise.all([loadEntitlements(), loadPlanModules()])
      .catch(err => { if (!cancelled) setError(err.message || 'Erreur de chargement.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [currentTenantId, loadEntitlements, loadPlanModules])

  // ── Toggle ────────────────────────────────────────────────────────────────
  async function handleToggle(moduleCode, currentEnabled) {
    setBusy(moduleCode)
    setError(null)

    // Optimistic UI
    setEnts(prev => {
      const existing = prev.find(e => e.module_code === moduleCode && !e.feature_code)
      if (existing) {
        return prev.map(e =>
          e.id === existing.id
            ? { ...e, enabled: !currentEnabled, source: 'override' }
            : e
        )
      }
      return [...prev, {
        id: `tmp-${moduleCode}`,
        tenant_id: currentTenantId,
        module_code: moduleCode,
        feature_code: null,
        enabled: !currentEnabled,
        source: 'override',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }]
    })

    try {
      await api.setEntitlement(currentTenantId, moduleCode, !currentEnabled)
      await loadEntitlements()
    } catch (err) {
      setError(err.message || 'Erreur lors de la mise à jour.')
      await loadEntitlements()
    } finally {
      setBusy(null)
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const planCodes = new Set(planModules.map(pm => pm.module_code))
  const findEnt   = code => ents.find(e => e.module_code === code && !e.feature_code)

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Chargement des modules…
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Modules"
        description="Activez ou désactivez les modules disponibles dans votre plan."
      />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {MODULE_CATEGORIES.map(category => {
        const mods = MODULES.filter(m => m.category === category)
        if (mods.length === 0) return null

        return (
          <section key={category}>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              {MODULE_CATEGORY_LABELS[category]}
            </h2>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {mods.map(m => {
                const entitlement  = findEnt(m.code)
                const isEnabled    = entitlement?.enabled ?? false
                const source       = entitlement?.source ?? null
                const isBusy       = busy === m.code

                // plan_modules is the source of truth for what's in the plan
                const inPlan       = planCodes.has(m.code)
                // A module locked to the plan cannot be toggled from the UI
                const isPlanLocked = source === 'plan' && inPlan
                // Module not in current plan → show upgrade CTA
                const isNotIncluded = planModules.length > 0 && !inPlan
                // Can the user toggle this module?
                const toggleable   = canToggle && m.availableForActivation && !isPlanLocked && !isNotIncluded

                const sb = source ? SOURCE_BADGE[source] : null

                return (
                  <div
                    key={m.code}
                    className={cn(
                      'rounded-xl border bg-white p-4 flex flex-col gap-3 transition-opacity',
                      isNotIncluded && 'opacity-60',
                    )}
                  >
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 text-sm">{m.name}</span>
                        {m.state && m.state !== 'GA' && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 uppercase">
                            {m.state}
                          </span>
                        )}
                        {sb && (
                          <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', sb.cls)}>
                            {sb.label}
                          </span>
                        )}
                      </div>

                      {/* Toggle or status */}
                      {toggleable ? (
                        <button
                          onClick={() => handleToggle(m.code, isEnabled)}
                          disabled={isBusy}
                          aria-pressed={isEnabled}
                          className={cn(
                            'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent',
                            'transition-colors duration-200 focus:outline-none focus-visible:ring-2',
                            'focus-visible:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed',
                            isEnabled ? 'bg-indigo-600' : 'bg-gray-200',
                          )}
                        >
                          <span
                            className={cn(
                              'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow',
                              'transform transition-transform duration-200',
                              isEnabled ? 'translate-x-4' : 'translate-x-0',
                            )}
                          />
                        </button>
                      ) : (
                        <StatusBadge
                          status={isEnabled ? 'active' : 'inactive'}
                          label={isEnabled ? 'Actif' : 'Inactif'}
                        />
                      )}
                    </div>

                    {/* Description */}
                    <p className="text-xs text-gray-500">{m.description}</p>

                    {/* Plan inclusion hint */}
                    {Array.isArray(m.plans) && m.plans.length > 0 && (
                      <p className="text-xs text-gray-400">
                        Inclus dans : {m.plans.join(', ')}
                      </p>
                    )}

                    {/* Source-specific subtext */}
                    {isPlanLocked && (
                      <p className="text-xs text-blue-600 font-medium">
                        Inclus dans votre plan — géré automatiquement
                      </p>
                    )}
                    {isNotIncluded && (
                      <p className="text-xs text-amber-600 font-medium">
                        Non inclus — Mettre à niveau
                      </p>
                    )}

                    {/* Last update */}
                    {entitlement && (
                      <p className="text-xs text-gray-400">
                        Dernière mise à jour :{' '}
                        {new Date(entitlement.updated_at).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
