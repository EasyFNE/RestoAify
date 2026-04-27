import { useEffect, useState } from 'react'
import PageHeader from '../../components/PageHeader.jsx'
import StatCard from '../../components/StatCard.jsx'
import DataTable from '../../components/DataTable.jsx'
import { api } from '../../services/api.js'

export default function PlatformDashboard() {
  const [stats, setStats] = useState({ tenants: 0, restaurants: 0, users: 0, modulesEnabled: 0 })
  const [recentAudit, setRecentAudit] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const tenants = await api.listTenants()
      let restaurantsTotal = 0
      let usersTotal = 0
      let modulesEnabledTotal = 0
      for (const t of tenants) {
        const [restaurants, members, ents] = await Promise.all([
          api.listRestaurants(t.id),
          api.listTenantUsers(t.id),
          api.listEntitlements(t.id),
        ])
        restaurantsTotal += restaurants.length
        usersTotal += members.length
        modulesEnabledTotal += ents.filter(e => e.enabled).length
      }
      const audit = await api.listAuditLogs() // platform scope
      if (cancelled) return
      setStats({
        tenants: tenants.length,
        restaurants: restaurantsTotal,
        users: usersTotal,
        modulesEnabled: modulesEnabledTotal,
      })
      setRecentAudit(audit.slice(0, 5))
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <div>
      <PageHeader title="Dashboard plateforme" subtitle="Vue d'ensemble globale" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Tenants"          value={loading ? '…' : stats.tenants} />
        <StatCard label="Restaurants"      value={loading ? '…' : stats.restaurants} />
        <StatCard label="Utilisateurs"     value={loading ? '…' : stats.users} />
        <StatCard label="Modules activés"  value={loading ? '…' : stats.modulesEnabled} hint="Toutes tenants confondus" />
      </div>

      <div className="mb-2 text-xs uppercase tracking-wide text-gray-500">Activité récente</div>
      <DataTable
        loading={loading}
        searchable={false}
        columns={[
          { key: 'created_at', header: 'Date',     render: r => new Date(r.created_at).toLocaleString('fr-FR') },
          { key: 'tenant_id',  header: 'Tenant',   render: r => r.tenant_id?.slice(0, 8) || '—' },
          { key: 'action',     header: 'Action' },
          { key: 'entity_type',header: 'Entité',   render: r => `${r.entity_type} · ${r.entity_id?.slice(0, 8) || '—'}` },
        ]}
        data={recentAudit}
        emptyMessage="Aucune activité récente."
      />
    </div>
  )
}
