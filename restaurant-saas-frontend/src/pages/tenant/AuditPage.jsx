import { useEffect, useState } from 'react'
import PageHeader from '../../components/PageHeader.jsx'
import DataTable from '../../components/DataTable.jsx'
import { api } from '../../services/api.js'
import { useTenant } from '../../hooks/useTenant.js'

export default function AuditPage() {
  const { currentTenantId } = useTenant()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentTenantId) return
    let cancelled = false
    api.listAuditLogs(currentTenantId).then(d => {
      if (!cancelled) { setLogs(d); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [currentTenantId])

  return (
    <div>
      <PageHeader
        title="Audit"
        subtitle="Journal des actions sensibles sur ce tenant"
      />
      <DataTable
        loading={loading}
        data={logs}
        columns={[
          { key: 'created_at',   header: 'Date',     render: r => new Date(r.created_at).toLocaleString('fr-FR') },
          { key: 'actor_type',   header: 'Acteur',   render: r => r.actor_type },
          { key: 'action',       header: 'Action' },
          { key: 'entity_type',  header: 'Entité',   render: r => `${r.entity_type} · ${r.entity_id?.slice(0, 8) || '—'}` },
          { key: 'metadata',     header: 'Détails',  render: r => Object.keys(r.metadata || {}).length ? <code className="text-xs">{JSON.stringify(r.metadata)}</code> : '—' },
        ]}
        emptyTitle="Aucune activité"
        emptyMessage="Les actions sensibles seront listées ici."
      />
    </div>
  )
}
