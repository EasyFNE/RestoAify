import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader.jsx'
import DataTable from '../../components/DataTable.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { api } from '../../services/api.js'
import { useTenant } from '../../hooks/useTenant.js'

// Lists conversations for the current tenant.
// Read-only in v1: conversations are created by the inbound n8n workflow,
// not from the back-office.
//
// Aligned with 02-data-model §3.4. Status set covers the full conversation
// state machine — see 06-lifecycle-status §7.

function formatRelative(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const m = Math.round(diffMs / 60000)
  if (m < 1) return 'à l\'instant'
  if (m < 60) return `il y a ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `il y a ${h} h`
  return d.toLocaleDateString('fr-FR')
}

function contactDisplayName(contact) {
  if (!contact) return '—'
  return contact.full_name ||
    [contact.first_name, contact.last_name].filter(Boolean).join(' ') ||
    contact.email ||
    '—'
}

export default function ConversationsPage() {
  const { currentTenantId } = useTenant()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    if (!currentTenantId) return
    let cancelled = false
    setLoading(true)
    api.listConversations(currentTenantId).then(d => {
      if (!cancelled) { setRows(d); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [currentTenantId])

  const filtered = statusFilter === 'all'
    ? rows
    : rows.filter(r => r.status === statusFilter)

  const counts = rows.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    return acc
  }, {})

  const STATUS_TABS = [
    { key: 'all', label: 'Toutes', count: rows.length },
    { key: 'open', label: 'Ouvertes', count: counts.open || 0 },
    { key: 'awaiting_human', label: 'Attente humain', count: counts.awaiting_human || 0 },
    { key: 'closed', label: 'Fermées', count: counts.closed || 0 },
  ]

  const columns = [
    {
      key: 'contact',
      label: 'Contact',
      render: (_, row) => contactDisplayName(row.contact),
    },
    {
      key: 'channel',
      label: 'Canal',
      render: (_, row) => row.channel?.channel_type ?? '—',
    },
    {
      key: 'status',
      label: 'Statut',
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: 'current_context_type',
      label: 'Contexte',
      render: (v) => v ?? '—',
    },
    {
      key: 'last_message_at',
      label: 'Dernier message',
      render: (v) => formatRelative(v),
    },
  ]

  return (
    <div className="p-6 space-y-4">
      <PageHeader title="Conversations" subtitle="Toutes les conversations du tenant" />

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              statusFilter === tab.key
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1.5 text-xs opacity-80">({tab.count})</span>
            )}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        emptyMessage="Aucune conversation trouvée."
        onRowClick={row => navigate(`/app/conversations/${row.id}`)}
      />
    </div>
  )
}
