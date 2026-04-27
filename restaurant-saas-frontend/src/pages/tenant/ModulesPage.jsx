import { useEffect, useState } from 'react'
import PageHeader from '../../components/PageHeader.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { api } from '../../services/api.js'
import { useTenant } from '../../hooks/useTenant.js'
import { useFeatureFlag } from '../../hooks/useFeatureFlag.js'
import { MODULES } from '../../config/modules.js'

export default function ModulesPage() {
  const { currentTenantId } = useTenant()
  const [ents, setEnts] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const canToggle = useFeatureFlag('enableEntitlementToggle')

  useEffect(() => {
    if (!currentTenantId) return
    let cancelled = false
    api.listEntitlements(currentTenantId).then(d => {
      if (!cancelled) { setEnts(d); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [currentTenantId])

  async function toggle(moduleCode, currentEnabled) {
    setBusy(moduleCode)
    try {
      const updated = await api.setEntitlement(currentTenantId, moduleCode, !currentEnabled)
      setEnts(prev => {
        const existing = prev.find(e => e.module_code === moduleCode && !e.feature_code)
        if (existing) return prev.map(e => e.id === existing.id ? updated : e)
        return [...prev, updated]
      })
    } finally {
      setBusy(null)
    }
  }

  function findEnt(code) {
    return ents.find(e => e.module_code === code && !e.feature_code)
  }

  return (
    <div>
      <PageHeader
        title="Modules"
        subtitle="Activation des modules pour ce tenant — pilote tenant_entitlements"
      />

      {loading ? (
        <div className="card p-6 text-gray-500">Chargement…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {MODULES.map(m => {
            const ent = findEnt(m.code)
            const enabled = !!ent?.enabled
            const isBusy = busy === m.code
            return (
              <div key={m.code} className="card p-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{m.name}</h3>
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                      {m.state}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                      {m.category}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">{m.description}</p>
                  {ent && (
                    <p className="text-[11px] text-gray-400 mt-2">
                      source : {ent.source} · maj {new Date(ent.updated_at).toLocaleDateString('fr-FR')}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusBadge status={enabled ? 'enabled' : 'disabled'} />
                  {canToggle && m.availableForActivation && (
                    <button
                      onClick={() => toggle(m.code, enabled)}
                      disabled={isBusy}
                      className={enabled ? 'btn-secondary' : 'btn-primary'}
                    >
                      {isBusy ? '…' : (enabled ? 'Désactiver' : 'Activer')}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
