import { useEffect, useState } from 'react'
import PageHeader from '../../components/PageHeader.jsx'
import StatCard from '../../components/StatCard.jsx'
import DataTable from '../../components/DataTable.jsx'
import { api } from '../../services/api.js'
import { useTenant } from '../../hooks/useTenant.js'

export default function TenantDashboard() {
  const { currentTenantId, currentTenant } = useTenant()
  const [stats, setStats] = useState({ restaurants: 0, members: 0, modules: 0, channels: 0 })
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentTenantId) return
    let cancelled = false
    async function load() {
      const [rr, mm, ee, cc, aa] = await Promise.all([
        api.listRestaurants(currentTenantId),
        api.listTenantUsers(currentTenantId),
        api.listEntitlements(currentTenantId),
        api.listChannels(currentTenantId),
        api.listAuditLogs(currentTenantId),
      ])
      if (cancelled) return
      setStats({
        restaurants: rr.length,
        members: mm.length,
        modules: ee.filter(e => e.enabled).length,
        channels: cc.length,
      })
      setRecent(aa.slice(0, 5))
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [currentTenantId])

  return (
    <div>
      <PageHeader
        title={`Bonjour 👋 ${currentTenant?.name ? `· ${currentTenant.name}` : ''}`}
        subtitle="Vue d'ensemble de votre tenant"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Restaurants" value={loading ? '…' : stats.restaurants} />
        <StatCard label="Utilisateurs" value={loading ? '…' : stats.members} />
        <StatCard label="Modules activés" value={loading ? '…' : stats.modules} />
        <StatCard label="Canaux" value={loading ? '…' : stats.channels} />
      </div>

      <div className="mb-2 text-xs uppercase tracking-wide text-gray-500">Activité récente</div>
      <DataTable
        loading={loading}
        searchable={false}
        data={recent}
        columns={[
          { key: 'created_at',  header: 'Date',   render: r => new Date(r.created_at).toLocaleString('fr-FR') },
          { key: 'actor_type',  header: 'Acteur', render: r => r.actor_type },
          { key: 'action',      header: 'Action' },
          { key: 'entity_type', header: 'Entité', render: r => r.entity_type },
        ]}
        emptyMessage="Aucune activité récente."
      />
    </div>
  )
}
