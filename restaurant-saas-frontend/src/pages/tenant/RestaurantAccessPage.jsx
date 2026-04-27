import { useEffect, useState } from 'react'
import PageHeader from '../../components/PageHeader.jsx'
import DataTable from '../../components/DataTable.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { api } from '../../services/api.js'
import { useTenant } from '../../hooks/useTenant.js'

// This page surfaces `restaurant_users` (per-restaurant access).
// Read-only in v1 — full UI for granting/revoking access comes later.
// Structure is in place so adding the create form is a 30-min job.
export default function RestaurantAccessPage() {
  const { currentTenantId } = useTenant()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentTenantId) return
    let cancelled = false
    api.listRestaurantUsers(currentTenantId).then(d => {
      if (!cancelled) { setRows(d); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [currentTenantId])

  return (
    <div>
      <PageHeader
        title="Accès par restaurant"
        subtitle="Affectations restaurant_users — qui a accès à quel restaurant"
      />

      <div className="card p-3 mb-4 text-xs text-amber-800 bg-amber-50 border-amber-200">
        Lecture seule en v1. La création/révocation viendra dans la prochaine itération.
      </div>

      <DataTable
        loading={loading}
        data={rows}
        columns={[
          { key: 'user',       header: 'Utilisateur', render: r => <span className="font-medium text-gray-900">{r.user?.full_name || '—'}</span> },
          { key: 'email',      header: 'Email',       render: r => r.user?.email || '—' },
          { key: 'restaurant', header: 'Restaurant',  render: r => r.restaurant?.name || '—' },
          { key: 'role_code',  header: 'Rôle local',  render: r => <span className="text-xs uppercase tracking-wide">{r.role_code}</span> },
          { key: 'status',     header: 'Statut',      render: r => <StatusBadge status={r.status} /> },
        ]}
        emptyTitle="Aucune affectation par restaurant"
        emptyMessage="Tous les rôles sont gérés au niveau tenant pour l'instant."
      />
    </div>
  )
}
