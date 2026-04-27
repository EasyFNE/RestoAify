import { useEffect, useState } from 'react'
import PageHeader from '../../components/PageHeader.jsx'
import DataTable from '../../components/DataTable.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import Button from '../../components/Button.jsx'
import FormField from '../../components/FormField.jsx'
import { api } from '../../services/api.js'
import { useTenant } from '../../hooks/useTenant.js'

// Default tenant-scoped roles, aligned with 07-security-access.md §2.1
const ROLE_OPTIONS = [
  { value: 'tenant_owner', label: 'Tenant Owner' },
  { value: 'tenant_admin', label: 'Tenant Admin' },
  { value: 'manager',      label: 'Manager' },
  { value: 'staff',        label: 'Staff' },
  { value: 'kitchen',      label: 'Kitchen' },
]

export default function UsersPage() {
  const { currentTenantId } = useTenant()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ email: '', full_name: '', role_code: 'staff' })

  useEffect(() => {
    if (!currentTenantId) return
    let cancelled = false
    api.listTenantUsers(currentTenantId).then(d => {
      if (!cancelled) { setMembers(d); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [currentTenantId])

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.email) return
    const m = await api.createTenantUser(currentTenantId, form)
    setMembers(prev => [...prev, m])
    setCreating(false)
    setForm({ email: '', full_name: '', role_code: 'staff' })
  }

  return (
    <div>
      <PageHeader
        title="Utilisateurs"
        subtitle="Membres rattachés à votre tenant"
        actions={
          <Button onClick={() => setCreating(v => !v)}>
            {creating ? 'Annuler' : '+ Inviter un utilisateur'}
          </Button>
        }
      />

      {creating && (
        <form onSubmit={handleCreate} className="card p-4 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="Email" name="email" type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <FormField label="Nom complet" name="full_name" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
          <FormField label="Rôle" name="role_code" as="select" options={ROLE_OPTIONS} value={form.role_code} onChange={e => setForm({ ...form, role_code: e.target.value })} />
          <div className="sm:col-span-3 flex justify-end">
            <Button type="submit">Inviter</Button>
          </div>
        </form>
      )}

      <DataTable
        loading={loading}
        data={members}
        columns={[
          { key: 'full_name', header: 'Nom',    render: r => <span className="font-medium text-gray-900">{r.user?.full_name || '—'}</span> },
          { key: 'email',     header: 'Email',  render: r => r.user?.email || '—' },
          { key: 'role_code', header: 'Rôle',   render: r => <span className="text-xs uppercase tracking-wide">{r.role_code}</span> },
          { key: 'status',    header: 'Statut', render: r => <StatusBadge status={r.status} /> },
          { key: 'created_at',header: 'Ajouté le', render: r => new Date(r.created_at).toLocaleDateString('fr-FR') },
        ]}
        emptyTitle="Aucun utilisateur"
        emptyMessage="Invitez le premier membre de votre équipe."
      />
    </div>
  )
}
