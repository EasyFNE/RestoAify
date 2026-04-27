import { useEffect, useState } from 'react'
import PageHeader from '../../components/PageHeader.jsx'
import DataTable from '../../components/DataTable.jsx'
import { api } from '../../services/api.js'

export default function PlatformAuditPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api.listAuditLogs().then(d => {
      if (!cancelled) { setLogs(d); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [])

  return (
    <div>
      <PageHeader title="Audit plateforme" subtitle="Toutes tenants confondus — accès restreint Platform Admin" />
      <DataTable
        loading={loading}
        data={logs}
        columns={[
          { key: 'created_at',  header: 'Date',     render: r => new Date(r.created_at).toLocaleString('fr-FR') },
          { key: 'tenant_id',   header: 'Tenant',   render: r => <code className="text-xs">{r.tenant_id?.slice(0, 8)}</code> },
          { key: 'actor_type',  header: 'Acteur',   render: r => `${r.actor_type}${r.actor_id ? ' · ' + r.actor_id.slice(0, 8) : ''}` },
          { key: 'action',      header: 'Action' },
          { key: 'entity_type', header: 'Entité',   render: r => `${r.entity_type} · ${r.entity_id?.slice(0, 8) || '—'}` },
        ]}
      />
    </div>
  )
}
