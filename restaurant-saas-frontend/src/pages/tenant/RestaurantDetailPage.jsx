import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PageHeader from '../../components/PageHeader.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { api } from '../../services/api.js'
import { useTenant } from '../../hooks/useTenant.js'

export default function RestaurantDetailPage() {
  const { id } = useParams()
  const { currentTenantId } = useTenant()
  const [r, setR] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentTenantId) return
    let cancelled = false
    api.getRestaurant(currentTenantId, id).then(d => {
      if (!cancelled) { setR(d); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [currentTenantId, id])

  if (loading) return <div className="card p-6 text-gray-500">Chargement…</div>
  if (!r) return <div className="card p-6 text-red-600">Restaurant introuvable.</div>

  return (
    <div>
      <PageHeader
        title={r.name}
        subtitle={
          <span>
            <Link to="/app/restaurants" className="text-brand-600 hover:underline">Restaurants</Link>
            <span className="mx-1">/</span>
            <span>{r.name}</span>
          </span>
        }
        actions={<StatusBadge status={r.status} />}
      />

      <div className="card p-6 max-w-2xl">
        <dl className="text-sm space-y-3">
          <Row label="ID"           value={<code className="text-xs">{r.id}</code>} />
          <Row label="Tenant ID"    value={<code className="text-xs">{r.tenant_id}</code>} />
          <Row label="Type"         value={r.restaurant_type} />
          <Row label="Fuseau"       value={r.timezone} />
          <Row label="Devise"       value={r.currency} />
          <Row label="Adresse"      value={r.address || '—'} />
          <Row label="Statut"       value={<StatusBadge status={r.status} />} />
          <Row label="Créé le"     value={new Date(r.created_at).toLocaleString('fr-FR')} />
        </dl>
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500 w-32 shrink-0">{label}</dt>
      <dd className="text-gray-900 text-right flex-1">{value}</dd>
    </div>
  )
}
