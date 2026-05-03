import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PageHeader from '../../components/PageHeader.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import Button from '../../components/Button.jsx'
import DataTable from '../../components/DataTable.jsx'
import { api } from '../../services/api.js'
import { useTenant } from '../../hooks/useTenant.js'

// Order detail with status-transition buttons.
// The transition list is mirrored from the backend (see
// 06-lifecycle-status §3.3). Cancellation prompts for a reason because
// the business rule recommends one for sensitive transitions.

const ORDER_TRANSITIONS = [
  ['draft', 'awaiting_confirmation'],
  ['draft', 'cancelled'],
  ['awaiting_confirmation', 'confirmed'],
  ['awaiting_confirmation', 'cancelled'],
  ['confirmed', 'in_preparation'],
  ['confirmed', 'cancelled'],
  ['in_preparation', 'ready'],
  ['in_preparation', 'cancelled'],
  ['ready', 'delivered'],
  ['delivered', 'closed'],
]

function nextStatusesFrom(status) {
  return ORDER_TRANSITIONS.filter(([f]) => f === status).map(([, t]) => t)
}

const TRANSITION_LABELS = {
  awaiting_confirmation: 'Demander confirmation',
  confirmed: 'Confirmer',
  in_preparation: 'Lancer la préparation',
  ready: 'Prête',
  delivered: 'Livrée',
  closed: 'Clôturer',
  cancelled: 'Annuler',
}

function formatMoney(amount, currency = 'XOF') {
  if (amount == null) return '—'
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency', currency, maximumFractionDigits: 0,
    }).format(amount)
  } catch { return `${amount} ${currency}` }
}

function contactDisplayName(c) {
  return c?.full_name || [c?.first_name, c?.last_name].filter(Boolean).join(' ') || c?.email || '—'
}

export default function OrderDetailPage() {
  const { id } = useParams()
  const { currentTenantId } = useTenant()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [acting, setActing] = useState(false)

  useEffect(() => {
    if (!currentTenantId || !id) return
    let cancelled = false
    setLoading(true)
    api.getOrder(currentTenantId, id)
      .then(o => {
        if (cancelled) return
        if (!o) setError('Commande introuvable')
        else setOrder(o)
        setLoading(false)
      })
      .catch(err => { if (!cancelled) { setError(err.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [currentTenantId, id])

  async function handleTransition(toStatus) {
    if (!order || acting) return
    let reason = null
    if (toStatus === 'cancelled') {
      reason = window.prompt('Motif d\'annulation (obligatoire) :')?.trim() || null
      if (!reason) return
    }
    setActing(true)
    setError(null)
    try {
      await api.updateOrderStatus(currentTenantId, id, toStatus, { reason })
      const refreshed = await api.getOrder(currentTenantId, id)
      setOrder(refreshed)
    } catch (err) {
      setError(err.message || 'La transition a échoué.')
    } finally {
      setActing(false)
    }
  }

  const nextStatuses = useMemo(
    () => order ? nextStatusesFrom(order.status) : [],
    [order],
  )

  if (loading) return <div className="p-8 text-gray-500">Chargement…</div>
  if (error && !order) return <div className="p-8 text-red-600">{error}</div>
  if (!order) return null

  const itemColumns = [
    { key: 'item_name_snapshot', label: 'Article' },
    { key: 'qty', label: 'Qté' },
    { key: 'unit_price', label: 'Prix unit.', render: (v, row) => formatMoney(v, order.currency) },
    { key: 'line_total', label: 'Total ligne', render: (v) => formatMoney(v, order.currency) },
    { key: 'special_instructions', label: 'Instructions', render: v => v ?? '—' },
  ]

  const historyColumns = [
    { key: 'from_status', label: 'De' },
    { key: 'to_status', label: 'Vers' },
    { key: 'actor_type', label: 'Acteur' },
    { key: 'reason', label: 'Motif', render: v => v ?? '—' },
    { key: 'created_at', label: 'Date', render: v => v ? new Date(v).toLocaleString('fr-FR') : '—' },
  ]

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={`Commande ${order.order_number}`}
        subtitle={`${contactDisplayName(order.contact)} · ${order.service_type} · ${order.restaurant?.name ?? '—'}`}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate(-1)}>← Retour</Button>
          </div>
        }
      />

      {/* Status + transitions */}
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={order.status} />
        {nextStatuses.map(s => (
          <Button
            key={s}
            variant={s === 'cancelled' ? 'danger' : 'primary'}
            disabled={acting}
            onClick={() => handleTransition(s)}
          >
            {TRANSITION_LABELS[s] ?? s}
          </Button>
        ))}
        {nextStatuses.length === 0 && (
          <span className="text-sm text-gray-400">Statut terminal — aucune transition disponible.</span>
        )}
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {/* Summary */}
      <div className="bg-white border rounded-xl p-5 shadow-sm grid grid-cols-3 gap-4 text-sm">
        <div><span className="text-gray-500">Total</span><p className="font-semibold">{formatMoney(order.total_amount, order.currency)}</p></div>
        <div><span className="text-gray-500">Articles</span><p className="font-semibold">{order.items_count}</p></div>
        <div><span className="text-gray-500">Demandé pour</span><p className="font-semibold">{order.requested_for ? new Date(order.requested_for).toLocaleString('fr-FR') : '—'}</p></div>
        {order.notes && <div className="col-span-3"><span className="text-gray-500">Notes</span><p className="text-gray-800">{order.notes}</p></div>}
      </div>

      {/* Items */}
      <div className="bg-white border rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold text-gray-700 mb-3">Articles</h3>
        <DataTable columns={itemColumns} data={order.items ?? []} emptyMessage="Aucun article." />
      </div>

      {/* History */}
      <div className="bg-white border rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold text-gray-700 mb-3">Historique des statuts</h3>
        <DataTable columns={historyColumns} data={order.history ?? []} emptyMessage="Aucun historique." />
      </div>
    </div>
  )
}
