import { useEffect, useState } from 'react'
import PageHeader from '../../components/PageHeader.jsx'
import DataTable from '../../components/DataTable.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import Button from '../../components/Button.jsx'
import FormField from '../../components/FormField.jsx'
import { api } from '../../services/api.js'
import { useTenant } from '../../hooks/useTenant.js'

// Rôles valides pour restaurant_users
// CHECK (role_code = ANY (ARRAY['manager','staff','kitchen']))
const ROLE_OPTIONS = [
  { value: 'manager', label: 'Manager' },
  { value: 'staff',   label: 'Staff' },
  { value: 'kitchen', label: 'Kitchen' },
]

const EMPTY_FORM = { user_id: '', restaurant_id: '', role_code: 'staff' }

export default function RestaurantAccessPage() {
  const { currentTenantId } = useTenant()
  const [rows, setRows]           = useState([])
  const [restaurants, setRestaurants] = useState([])
  const [tenantUsers, setTenantUsers] = useState([])
  const [loading, setLoading]     = useState(true)
  const [creating, setCreating]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [revoking, setRevoking]   = useState(null) // id en cours de révocation
  const [error, setError]         = useState(null)
  const [success, setSuccess]     = useState(null)
  const [form, setForm]           = useState(EMPTY_FORM)

  useEffect(() => {
    if (!currentTenantId) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      api.listRestaurantUsers(currentTenantId),
      api.listRestaurants(currentTenantId),
      api.listTenantUsers(currentTenantId),
    ]).then(([ru, rs, tu]) => {
      if (!cancelled) {
        setRows(ru)
        setRestaurants(rs)
        setTenantUsers(tu)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [currentTenantId])

  function handleField(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleCreate(e) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (!form.user_id || !form.restaurant_id) {
      setError('Utilisateur et restaurant sont obligatoires.')
      return
    }
    setSubmitting(true)
    try {
      const created = await api.createRestaurantUser(currentTenantId, form)
      setRows(prev => [...prev, created])
      setSuccess('Accès accordé avec succès.')
      setCreating(false)
      setForm(EMPTY_FORM)
    } catch (err) {
      setError(err.message || "Erreur lors de l'ajout.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRevoke(row) {
    if (!window.confirm(`Révoquer l'accès de ${row.user?.full_name || row.user_id} sur ${row.restaurant?.name || row.restaurant_id} ?`)) return
    setRevoking(row.id)
    setError(null)
    try {
      await api.revokeRestaurantUser(currentTenantId, row.id)
      setRows(prev => prev.filter(r => r.id !== row.id))
      setSuccess('Accès révoqué.')
    } catch (err) {
      setError(err.message || 'Erreur lors de la révocation.')
    } finally {
      setRevoking(null)
    }
  }

  function handleCancel() {
    setCreating(false)
    setForm(EMPTY_FORM)
    setError(null)
  }

  const userOptions = tenantUsers.map(m => ({
    value: m.user_id,
    label: m.user ? `${m.user.full_name || m.user.email} (${m.user.email})` : m.user_id,
  }))

  const restaurantOptions = restaurants.map(r => ({
    value: r.id,
    label: r.name,
  }))

  return (
    <div>
      <PageHeader
        title="Accès par restaurant"
        subtitle="Affectations restaurant_users — qui a accès à quel restaurant"
        actions={
          <Button onClick={() => { setCreating(v => !v); setError(null) }}>
            {creating ? 'Annuler' : '+ Ajouter un accès'}
          </Button>
        }
      />

      {/* Bandeau succès */}
      {success && (
        <div className="mb-4 rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 flex justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="text-green-600 hover:text-green-900 font-medium">×</button>
        </div>
      )}

      {/* Formulaire de création */}
      {creating && (
        <form
          onSubmit={handleCreate}
          className="bg-white border border-gray-200 rounded-lg p-5 mb-5 shadow-sm"
        >
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Nouvel accès par restaurant</h3>

          {error && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField
              label="Utilisateur *"
              name="user_id"
              as="select"
              options={userOptions}
              value={form.user_id}
              onChange={handleField}
            />
            <FormField
              label="Restaurant *"
              name="restaurant_id"
              as="select"
              options={restaurantOptions}
              value={form.restaurant_id}
              onChange={handleField}
            />
            <FormField
              label="Rôle local"
              name="role_code"
              as="select"
              options={ROLE_OPTIONS}
              value={form.role_code}
              onChange={handleField}
            />
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={handleCancel}>Annuler</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Ajout…' : "Accorder l'accès"}
            </Button>
          </div>
        </form>
      )}

      {/* Erreur hors formulaire (révocation) */}
      {!creating && error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <DataTable
        loading={loading}
        data={rows}
        columns={[
          { key: 'user',       header: 'Utilisateur', render: r => <span className="font-medium text-gray-900">{r.user?.full_name || '—'}</span> },
          { key: 'email',      header: 'Email',       render: r => r.user?.email || '—' },
          { key: 'restaurant', header: 'Restaurant',  render: r => r.restaurant?.name || '—' },
          { key: 'role_code',  header: 'Rôle local',  render: r => <span className="text-xs uppercase tracking-wide">{r.role_code}</span> },
          { key: 'status',     header: 'Statut',      render: r => <StatusBadge status={r.status} /> },
          {
            key: 'actions',
            header: '',
            render: r => (
              <button
                onClick={() => handleRevoke(r)}
                disabled={revoking === r.id}
                className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
              >
                {revoking === r.id ? 'Révocation…' : 'Révoquer'}
              </button>
            ),
          },
        ]}
        emptyTitle="Aucune affectation par restaurant"
        emptyMessage="Utilisez le bouton ci-dessus pour accorder un accès à un restaurant."
      />
    </div>
  )
}
