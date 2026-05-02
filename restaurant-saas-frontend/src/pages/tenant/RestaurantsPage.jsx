import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader.jsx'
import DataTable from '../../components/DataTable.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import Button from '../../components/Button.jsx'
import FormField from '../../components/FormField.jsx'
import { api } from '../../services/api.js'
import { useTenant } from '../../hooks/useTenant.js'

const TYPE_OPTIONS = [
  { value: 'restaurant',   label: 'Restaurant' },
  { value: 'dark_kitchen', label: 'Dark kitchen' },
  { value: 'lab',          label: 'Lab' },
  { value: 'venue',        label: 'Venue' },
]

const STATUS_OPTIONS = [
  { value: 'active',   label: 'Actif' },
  { value: 'inactive', label: 'Inactif' },
]

const EMPTY_FORM = {
  name: '', restaurant_type: 'restaurant',
  timezone: 'Africa/Abidjan', currency: 'XOF',
  address: '', status: 'active',
}

export default function RestaurantsPage() {
  const { currentTenantId } = useTenant()
  const navigate = useNavigate()

  const [items,     setItems]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)

  // create panel
  const [creating,  setCreating]  = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_FORM)

  // edit modal
  const [editing,   setEditing]   = useState(null)   // restaurant object
  const [editForm,  setEditForm]  = useState(EMPTY_FORM)

  // deactivate confirm
  const [confirmId, setConfirmId] = useState(null)

  useEffect(() => {
    if (!currentTenantId) return
    let cancelled = false
    api.listRestaurants(currentTenantId).then(d => {
      if (!cancelled) { setItems(d); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [currentTenantId])

  // ── Create
  async function handleCreate(e) {
    e.preventDefault()
    if (!createForm.name.trim()) return
    setSaving(true)
    try {
      const r = await api.createRestaurant(currentTenantId, createForm)
      setItems(prev => [...prev, r])
      setCreating(false)
      setCreateForm(EMPTY_FORM)
    } finally {
      setSaving(false)
    }
  }

  // ── Edit
  function openEdit(r, e) {
    e.stopPropagation()
    setEditing(r)
    setEditForm({
      name:            r.name,
      restaurant_type: r.restaurant_type,
      timezone:        r.timezone,
      currency:        r.currency,
      address:         r.address || '',
      status:          r.status,
    })
  }

  async function handleEdit(e) {
    e.preventDefault()
    if (!editForm.name.trim()) return
    setSaving(true)
    try {
      const updated = await api.updateRestaurant(currentTenantId, editing.id, editForm)
      setItems(prev => prev.map(x => x.id === updated.id ? updated : x))
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  // ── Deactivate
  async function handleDeactivate() {
    if (!confirmId) return
    setSaving(true)
    try {
      const updated = await api.deactivateRestaurant(currentTenantId, confirmId)
      setItems(prev => prev.map(x => x.id === updated.id ? updated : x))
      setConfirmId(null)
    } finally {
      setSaving(false)
    }
  }

  // ── Columns
  const columns = [
    { key: 'name',            header: 'Nom',     render: r => <span className="font-medium text-gray-900">{r.name}</span> },
    { key: 'restaurant_type', header: 'Type' },
    { key: 'timezone',        header: 'Fuseau' },
    { key: 'currency',        header: 'Devise' },
    { key: 'address',         header: 'Adresse', render: r => <span className="text-gray-600">{r.address || '—'}</span> },
    { key: 'status',          header: 'Statut',  render: r => <StatusBadge status={r.status} /> },
    {
      key: '_actions',
      header: '',
      render: r => (
        <div className="flex gap-2 justify-end" onClick={e => e.stopPropagation()}>
          <button
            className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 transition"
            onClick={e => openEdit(r, e)}
          >
            Modifier
          </button>
          {r.status === 'active' && (
            <button
              className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 transition"
              onClick={e => { e.stopPropagation(); setConfirmId(r.id) }}
            >
              Désactiver
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Restaurants"
        subtitle="Unités opérationnelles de votre tenant"
        actions={
          <Button onClick={() => { setCreating(v => !v); setCreateForm(EMPTY_FORM) }}>
            {creating ? 'Annuler' : '+ Nouveau restaurant'}
          </Button>
        }
      />

      {/* ── Formulaire création ── */}
      {creating && (
        <form
          onSubmit={handleCreate}
          className="card p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
        >
          <FormField label="Nom" name="name" value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} required />
          <FormField label="Type" name="restaurant_type" as="select" options={TYPE_OPTIONS} value={createForm.restaurant_type} onChange={e => setCreateForm({ ...createForm, restaurant_type: e.target.value })} required />
          <FormField label="Fuseau horaire" name="timezone" value={createForm.timezone} onChange={e => setCreateForm({ ...createForm, timezone: e.target.value })} />
          <FormField label="Devise" name="currency" value={createForm.currency} onChange={e => setCreateForm({ ...createForm, currency: e.target.value })} />
          <FormField label="Adresse" name="address" value={createForm.address} onChange={e => setCreateForm({ ...createForm, address: e.target.value })} />
          <FormField label="Statut" name="status" as="select" options={STATUS_OPTIONS} value={createForm.status} onChange={e => setCreateForm({ ...createForm, status: e.target.value })} />
          <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
            <Button type="submit" disabled={saving}>{saving ? 'En cours…' : 'Créer'}</Button>
          </div>
        </form>
      )}

      {/* ── Tableau ── */}
      <DataTable
        loading={loading}
        data={items}
        onRowClick={r => navigate(`/app/restaurants/${r.id}`)}
        columns={columns}
        emptyTitle="Aucun restaurant"
        emptyMessage="Ajoutez votre premier restaurant."
      />

      {/* ── Modale édition ── */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Modifier « {editing.name} »</h2>
            <form onSubmit={handleEdit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Nom" name="name" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required />
              <FormField label="Type" name="restaurant_type" as="select" options={TYPE_OPTIONS} value={editForm.restaurant_type} onChange={e => setEditForm({ ...editForm, restaurant_type: e.target.value })} required />
              <FormField label="Fuseau horaire" name="timezone" value={editForm.timezone} onChange={e => setEditForm({ ...editForm, timezone: e.target.value })} />
              <FormField label="Devise" name="currency" value={editForm.currency} onChange={e => setEditForm({ ...editForm, currency: e.target.value })} />
              <FormField label="Adresse" name="address" value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} className="sm:col-span-2" />
              <FormField label="Statut" name="status" as="select" options={STATUS_OPTIONS} value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} />
              <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                <Button variant="ghost" type="button" onClick={() => setEditing(null)}>Annuler</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Sauvegarde…' : 'Sauvegarder'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirm désactivation ── */}
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold mb-2">Désactiver ce restaurant ?</h2>
            <p className="text-sm text-gray-600 mb-6">
              Le restaurant passera en statut <strong>inactif</strong>. Vous pourrez le réactiver
              en le modifiant.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmId(null)} disabled={saving}>Annuler</Button>
              <Button variant="danger" onClick={handleDeactivate} disabled={saving}>
                {saving ? 'En cours…' : 'Désactiver'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
