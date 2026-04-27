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

export default function RestaurantsPage() {
  const { currentTenantId } = useTenant()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    name: '', restaurant_type: 'restaurant',
    timezone: 'Africa/Abidjan', currency: 'XOF',
    address: '', status: 'active',
  })

  useEffect(() => {
    if (!currentTenantId) return
    let cancelled = false
    api.listRestaurants(currentTenantId).then(d => {
      if (!cancelled) { setItems(d); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [currentTenantId])

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.name) return
    const r = await api.createRestaurant(currentTenantId, form)
    setItems(prev => [...prev, r])
    setCreating(false)
    setForm({
      name: '', restaurant_type: 'restaurant',
      timezone: 'Africa/Abidjan', currency: 'XOF',
      address: '', status: 'active',
    })
  }

  return (
    <div>
      <PageHeader
        title="Restaurants"
        subtitle="Unités opérationnelles de votre tenant"
        actions={
          <Button onClick={() => setCreating(v => !v)}>
            {creating ? 'Annuler' : '+ Nouveau restaurant'}
          </Button>
        }
      />

      {creating && (
        <form onSubmit={handleCreate} className="card p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <FormField label="Nom" name="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          <FormField label="Type" name="restaurant_type" as="select" options={TYPE_OPTIONS} value={form.restaurant_type} onChange={e => setForm({ ...form, restaurant_type: e.target.value })} required />
          <FormField label="Fuseau horaire" name="timezone" value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })} />
          <FormField label="Devise" name="currency" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} />
          <FormField label="Adresse" name="address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
          <FormField
            label="Statut"
            name="status"
            as="select"
            options={[{ value: 'active', label: 'active' }, { value: 'inactive', label: 'inactive' }]}
            value={form.status}
            onChange={e => setForm({ ...form, status: e.target.value })}
          />
          <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
            <Button type="submit">Créer</Button>
          </div>
        </form>
      )}

      <DataTable
        loading={loading}
        data={items}
        onRowClick={r => navigate(`/app/restaurants/${r.id}`)}
        columns={[
          { key: 'name',            header: 'Nom',     render: r => <span className="font-medium text-gray-900">{r.name}</span> },
          { key: 'restaurant_type', header: 'Type' },
          { key: 'timezone',        header: 'Fuseau' },
          { key: 'currency',        header: 'Devise' },
          { key: 'address',         header: 'Adresse', render: r => <span className="text-gray-600">{r.address || '—'}</span> },
          { key: 'status',          header: 'Statut',  render: r => <StatusBadge status={r.status} /> },
        ]}
        emptyTitle="Aucun restaurant"
        emptyMessage="Ajoutez votre premier restaurant."
      />
    </div>
  )
}
