import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader.jsx'
import DataTable from '../../components/DataTable.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { api } from '../../services/api.js'
import { useTenant } from '../../hooks/useTenant.js'

// Orders list with two filter dimensions:
// - status ∈ {draft, awaiting_confirmation, confirmed, in_preparation, ready, delivered, cancelled, closed}
// - service_type ∈ {delivery, pickup, dine_in}
// Status set comes from 06-lifecycle-status §3.1.

const ORDER_STATUSES = [
  'draft', 'awaiting_confirmation', 'confirmed',
  'in_preparation', 'ready', 'delivered', 'cancelled', 'closed',
]
const SERVICE_TYPES = ['delivery', 'pickup', 'dine_in']

function formatMoney(amount, currency = 'XOF') {
  if (amount == null) return '—'
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency', currency, maximumFractionDigits: 0,
    }).format(amount)
  } catch { return `${amount} ${currency}` }
}

function contactDisplayName(c) {
  return c?.full_name || [c?.first_name, c?.last_name].filter(Boolean).join(' ') || '—'
}

export default function OrdersPage() {
  const { currentTenantId } = useTenant()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [serviceFilter, setServiceFilter] = useState('all')

  useEffect(() => {
    if (!currentTenantId) return
    let cancelled = false
    setLoading(true)
    api.listOrders(currentTenantId).then(d => {
      if (!cancelled) { setRows(d); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [currentTenantId])

  const filtered = useMemo(
    () => rows.filter(r =>
      (statusFilter === 'all' || r.status === statusFilter) &&
      (serviceFilter === 'all' || r.service_type === serviceFilter),
    ),
    [rows, statusFilter, serviceFilter],
  )

  const columns = [
    { key: 'order_number', label: 'N°' },
    { key: 'contact', label: 'Client', render: (_, row) => contactDisplayName(row.contact) },
    { key: 'service_type', label: 'Type', render: v => v ?? '—' },
    { key: 'status', label: 'Statut', render: v => <StatusBadge status={v} /> },
    { key: 'total_amount', label: 'Total', render: (v, row) => formatMoney(v, row.currency) },
    { key: 'items_count', label: 'Articles' },
    {
      key: 'created_at',
      label: 'Créée le',
      render: v => v ? new Date(v).toLocaleDateString('fr-FR') : '—',
    },
  ]

  return (
    <div className="p-6 space-y-4">
      <PageHeader title="Commandes" subtitle="Toutes les commandes du tenant" />

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex gap-2 items-center">
          <span className="text-sm text-gray-500">Statut :</span>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="all">Tous</option>
            {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-sm text-gray-500">Type de service :</span>
          <select
            value={serviceFilter}
            onChange={e => setServiceFilter(e.target.value)}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="all">Tous</option>
            {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        emptyMessage="Aucune commande trouvée."
        onRowClick={row => navigate(`/app/orders/${row.id}`)}
      />
    </div>
  )
}
