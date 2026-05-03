import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader.jsx'
import DataTable from '../../components/DataTable.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import Button from '../../components/Button.jsx'
import FormField from '../../components/FormField.jsx'
import { api } from '../../services/api.js'
import { useTenant } from '../../hooks/useTenant.js'

// Contacts = end customers of the tenant (02-data-model §3.1).
// CRUD limited to create + update profile in v1.
//
// IMPORTANT (multi-tenant): every api call passes currentTenantId.

const EMPTY_FORM = {
  full_name: '', first_name: '', last_name: '',
  email: '', language: 'fr',
  channel_type: 'whatsapp', channel_value: '',
  notes: '',
}

function contactDisplayName(c) {
  return c?.full_name ||
    [c?.first_name, c?.last_name].filter(Boolean).join(' ') ||
    c?.email || '—'
}

function primaryChannelOf(contact) {
  if (!contact?.channels?.length) return null
  return contact.channels.find(ch => ch.is_primary) || contact.channels[0]
}

export default function ContactsPage() {
  const { currentTenantId } = useTenant()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    if (!currentTenantId) return
    let cancelled = false
    setLoading(true)
    api.listContacts(currentTenantId).then(d => {
      if (!cancelled) { setRows(d); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [currentTenantId])

  function handleField(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleCreate(e) {
    e.preventDefault()
    setError(null)
    if (!form.full_name && !form.first_name && !form.last_name) {
      setError('Renseignez au moins un nom complet ou prénom/nom.')
      return
    }
    setSubmitting(true)
    try {
      const created = await api.createContact(currentTenantId, form)
      const refreshed = await api.listContacts(currentTenantId)
      setRows(refreshed)
      setCreating(false)
      setForm(EMPTY_FORM)
      if (created?.id) navigate(`/app/customers/${created.id}`)
    } catch (err) {
      setError(err.message || 'Erreur lors de la création.')
    } finally {
      setSubmitting(false)
    }
  }

  const columns = [
    { key: 'full_name', label: 'Nom', render: (_, row) => contactDisplayName(row) },
    {
      key: 'channel',
      label: 'Canal principal',
      render: (_, row) => {
        const ch = primaryChannelOf(row)
        if (!ch) return '—'
        return `${ch.channel_type}: ${ch.channel_value}`
      },
    },
    { key: 'email', label: 'Email', render: v => v ?? '—' },
    { key: 'language', label: 'Langue', render: v => v ?? '—' },
    { key: 'status', label: 'Statut', render: v => <StatusBadge status={v} /> },
  ]

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Clients"
        subtitle="Base unifiée des contacts du tenant"
        action={
          <Button onClick={() => setCreating(true)}>+ Nouveau client</Button>
        }
      />

      {/* Create form */}
      {creating && (
        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-4">Nouveau contact</h3>
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <FormField label="Nom complet" name="full_name" value={form.full_name} onChange={handleField} />
            <FormField label="Prénom" name="first_name" value={form.first_name} onChange={handleField} />
            <FormField label="Nom" name="last_name" value={form.last_name} onChange={handleField} />
            <FormField label="Email" name="email" type="email" value={form.email} onChange={handleField} />
            <FormField label="Langue" name="language" value={form.language} onChange={handleField} />
            <FormField label="Canal (ex: whatsapp)" name="channel_type" value={form.channel_type} onChange={handleField} />
            <FormField label="Valeur canal (ex: +225…)" name="channel_value" value={form.channel_value} onChange={handleField} />
            <div className="col-span-2">
              <FormField label="Notes" name="notes" value={form.notes} onChange={handleField} />
            </div>
            <div className="col-span-2 flex gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Création…' : 'Créer'}
              </Button>
              <Button variant="secondary" type="button" onClick={() => { setCreating(false); setError(null) }}>
                Annuler
              </Button>
            </div>
          </form>
        </div>
      )}

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        emptyMessage="Aucun contact trouvé."
        onRowClick={row => navigate(`/app/customers/${row.id}`)}
      />
    </div>
  )
}
