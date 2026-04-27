import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader.jsx'
import DataTable from '../../components/DataTable.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import Button from '../../components/Button.jsx'
import FormField from '../../components/FormField.jsx'
import { api } from '../../services/api.js'
import { useFeatureFlag } from '../../hooks/useFeatureFlag.js'

export default function TenantsListPage() {
  const navigate = useNavigate()
  const [tenants, setTenants] = useState([])
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', slug: '', plan_id: '' })
  const allowCreate = useFeatureFlag('allowCreateTenant')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [tt, pp] = await Promise.all([api.listTenants(), api.listPlans()])
      if (cancelled) return
      setTenants(tt); setPlans(pp); setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.name || !form.slug) return
    const t = await api.createTenant(form)
    setTenants(prev => [...prev, t])
    setCreating(false)
    setForm({ name: '', slug: '', plan_id: '' })
  }

  return (
    <div>
      <PageHeader
        title="Tenants"
        subtitle="Toutes les organisations clientes de la plateforme"
        actions={allowCreate && (
          <Button onClick={() => setCreating(v => !v)}>
            {creating ? 'Annuler' : '+ Nouveau tenant'}
          </Button>
        )}
      />

      {creating && (
        <form onSubmit={handleCreate} className="card p-4 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="Nom" name="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          <FormField label="Slug" name="slug" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} required placeholder="le-spot" />
          <FormField
            label="Plan"
            name="plan_id"
            as="select"
            value={form.plan_id}
            onChange={e => setForm({ ...form, plan_id: e.target.value })}
            options={plans.map(p => ({ value: p.id, label: p.name }))}
          />
          <div className="sm:col-span-3 flex justify-end">
            <Button type="submit">Créer</Button>
          </div>
        </form>
      )}

      <DataTable
        loading={loading}
        data={tenants}
        onRowClick={row => navigate(`/platform/tenants/${row.id}`)}
        columns={[
          { key: 'name', header: 'Nom', render: r => <span className="font-medium text-gray-900">{r.name}</span> },
          { key: 'slug', header: 'Slug' },
          { key: 'status', header: 'Statut', render: r => <StatusBadge status={r.status} /> },
          { key: 'plan_id', header: 'Plan', render: r => plans.find(p => p.id === r.plan_id)?.name || '—' },
          { key: 'created_at', header: 'Créé le', render: r => new Date(r.created_at).toLocaleDateString('fr-FR') },
        ]}
        emptyTitle="Aucun tenant"
        emptyMessage="Créez le premier tenant pour démarrer."
      />
    </div>
  )
}
