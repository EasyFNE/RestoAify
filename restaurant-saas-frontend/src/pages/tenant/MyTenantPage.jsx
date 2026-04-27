import { useEffect, useState } from 'react'
import PageHeader from '../../components/PageHeader.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { api } from '../../services/api.js'
import { useTenant } from '../../hooks/useTenant.js'

export default function MyTenantPage() {
  const { currentTenant, currentTenantId } = useTenant()
  const [plans, setPlans] = useState([])

  useEffect(() => {
    api.listPlans().then(setPlans)
  }, [])

  if (!currentTenant) return <div className="card p-6 text-gray-500">Chargement…</div>

  const plan = plans.find(p => p.id === currentTenant.plan_id)

  return (
    <div>
      <PageHeader title="Mon tenant" subtitle="Informations générales de votre organisation" />
      <div className="card p-6 max-w-2xl">
        <dl className="text-sm space-y-3">
          <Row label="Nom"          value={<span className="font-medium">{currentTenant.name}</span>} />
          <Row label="Slug"         value={<code className="text-xs">{currentTenant.slug}</code>} />
          <Row label="ID"           value={<code className="text-xs">{currentTenantId}</code>} />
          <Row label="Plan"         value={plan?.name || '—'} />
          <Row label="Statut"       value={<StatusBadge status={currentTenant.status} />} />
          <Row label="Créé le"     value={new Date(currentTenant.created_at).toLocaleString('fr-FR')} />
          <Row label="Mis à jour"  value={new Date(currentTenant.updated_at).toLocaleString('fr-FR')} />
        </dl>
        <p className="text-xs text-gray-500 mt-6">
          Pour modifier ces informations, contactez votre administrateur ou utilisez
          la page Paramètres (formulaire d'édition à venir).
        </p>
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
