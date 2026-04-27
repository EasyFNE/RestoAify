import { useEffect, useState } from 'react'
import PageHeader from '../../components/PageHeader.jsx'
import DataTable from '../../components/DataTable.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import Button from '../../components/Button.jsx'
import FormField from '../../components/FormField.jsx'
import { api } from '../../services/api.js'
import { useTenant } from '../../hooks/useTenant.js'

// Rôles alignés sur la CHECK constraint réelle de la DB
// CHECK (role_code = ANY (ARRAY['owner','admin','manager','member','viewer']))
const ROLE_OPTIONS = [
  { value: 'owner',   label: 'Owner' },
  { value: 'admin',   label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'member',  label: 'Member' },
  { value: 'viewer',  label: 'Viewer' },
]

const EMPTY_FORM = { email: '', full_name: '', role_code: 'member', password: '' }

export default function UsersPage() {
  const { currentTenantId } = useTenant()
  const [members, setMembers]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [creating, setCreating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]       = useState(null)
  const [success, setSuccess]   = useState(null)
  const [form, setForm]         = useState(EMPTY_FORM)

  useEffect(() => {
    if (!currentTenantId) return
    let cancelled = false
    setLoading(true)
    api.listTenantUsers(currentTenantId).then(d => {
      if (!cancelled) { setMembers(d); setLoading(false) }
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
    if (!form.email || !form.password) {
      setError('Email et mot de passe sont obligatoires.')
      return
    }
    setSubmitting(true)
    try {
      const m = await api.createTenantUser(currentTenantId, form)
      setMembers(prev => [...prev, m])
      setSuccess(`Utilisateur ${form.email} créé avec succès.`)
      setCreating(false)
      setForm(EMPTY_FORM)
    } catch (err) {
      setError(err.message || 'Erreur lors de la création.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleCancel() {
    setCreating(false)
    setForm(EMPTY_FORM)
    setError(null)
  }

  return (
    <div>
      <PageHeader
        title="Utilisateurs"
        subtitle="Membres rattachés à votre tenant"
        actions={
          <Button onClick={() => { setCreating(v => !v); setError(null) }}>
            {creating ? 'Annuler' : '+ Inviter un utilisateur'}
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
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Nouvel utilisateur</h3>

          {error && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="Email *"
              name="email"
              type="email"
              required
              value={form.email}
              onChange={handleField}
              placeholder="prenom@example.com"
            />
            <FormField
              label="Nom complet"
              name="full_name"
              value={form.full_name}
              onChange={handleField}
              placeholder="Prénom Nom"
            />
            <FormField
              label="Mot de passe temporaire *"
              name="password"
              type="password"
              required
              value={form.password}
              onChange={handleField}
              placeholder="Min. 8 caractères"
            />
            <FormField
              label="Rôle"
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
              {submitting ? 'Création…' : 'Créer le compte'}
            </Button>
          </div>
        </form>
      )}

      <DataTable
        loading={loading}
        data={members}
        columns={[
          {
            key: 'full_name',
            header: 'Nom',
            render: r => <span className="font-medium text-gray-900">{r.user?.full_name || '—'}</span>,
          },
          { key: 'email',      header: 'Email',    render: r => r.user?.email || '—' },
          {
            key: 'role_code',
            header: 'Rôle',
            render: r => (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 uppercase tracking-wide">
                {r.role_code}
              </span>
            ),
          },
          { key: 'status',     header: 'Statut',   render: r => <StatusBadge status={r.status} /> },
          {
            key: 'created_at',
            header: 'Ajouté le',
            render: r => new Date(r.created_at).toLocaleDateString('fr-FR'),
          },
        ]}
        emptyTitle="Aucun utilisateur"
        emptyMessage="Invitez le premier membre de votre équipe."
      />
    </div>
  )
}
