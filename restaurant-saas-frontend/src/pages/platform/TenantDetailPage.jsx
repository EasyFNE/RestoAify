import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PageHeader from '../../components/PageHeader.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import StatCard from '../../components/StatCard.jsx'
import { api } from '../../services/api.js'

export default function TenantDetailPage() {
  const { id } = useParams()
  const [tenant, setTenant] = useState(null)
  const [restaurants, setRestaurants] = useState([])
  const [members, setMembers] = useState([])
  const [ents, setEnts] = useState([])
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [t, rr, mm, ee, pp] = await Promise.all([
        api.getTenant(id),
        api.listRestaurants(id),
        api.listTenantUsers(id),
        api.listEntitlements(id),
        api.listPlans(),
      ])
      if (cancelled) return
      setTenant(t); setRestaurants(rr); setMembers(mm); setEnts(ee); setPlans(pp)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [id])

  if (loading) return <div className="card p-6 text-gray-500">Chargement…</div>
  if (!tenant) return <div className="card p-6 text-red-600">Tenant introuvable.</div>

  const planName = plans.find(p => p.id === tenant.plan_id)?.name || '—'
  const enabled = ents.filter(e => e.enabled)

  return (
    <div>
      <PageHeader
        title={tenant.name}
        subtitle={
          <span>
            <Link to="/platform/tenants" className="text-brand-600 hover:underline">Tenants</Link>
            <span className="mx-1">/</span>
            <span>{tenant.slug}</span>
          </span>
        }
        actions={<StatusBadge status={tenant.status} />}
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <StatCard label="Restaurants" value={restaurants.length} />
        <StatCard label="Utilisateurs" value={members.length} />
        <StatCard label="Modules activés" value={enabled.length} />
        <StatCard label="Plan" value={planName} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Infos générales</h3>
          <dl className="text-sm space-y-2">
            <Row label="ID"          value={<code className="text-xs">{tenant.id}</code>} />
            <Row label="Slug"        value={tenant.slug} />
            <Row label="Plan"        value={planName} />
            <Row label="Statut"      value={<StatusBadge status={tenant.status} />} />
            <Row label="Créé le"    value={new Date(tenant.created_at).toLocaleString('fr-FR')} />
            <Row label="Mis à jour" value={new Date(tenant.updated_at).toLocaleString('fr-FR')} />
          </dl>
        </div>

        <div className="card p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Modules activés</h3>
          {enabled.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun module activé.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {enabled.map(e => (
                <li key={e.id} className="flex justify-between">
                  <span>{e.module_code}</span>
                  <span className="text-xs text-gray-500">{e.source}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-4 lg:col-span-2">
          <h3 className="font-semibold text-gray-900 mb-3">Restaurants ({restaurants.length})</h3>
          {restaurants.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun restaurant.</p>
          ) : (
            <ul className="text-sm divide-y divide-gray-100">
              {restaurants.map(r => (
                <li key={r.id} className="py-2 flex justify-between">
                  <span className="font-medium text-gray-900">{r.name}</span>
                  <span className="text-gray-500">{r.restaurant_type} · {r.address}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900 text-right">{value}</dd>
    </div>
  )
}
