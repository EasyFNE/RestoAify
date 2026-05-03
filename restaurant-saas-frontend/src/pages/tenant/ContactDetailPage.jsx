import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PageHeader from '../../components/PageHeader.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import Button from '../../components/Button.jsx'
import FormField from '../../components/FormField.jsx'
import DataTable from '../../components/DataTable.jsx'
import { api } from '../../services/api.js'
import { useTenant } from '../../hooks/useTenant.js'

// Contact detail + edit. Channels are read-only here in v1 — attach/detach
// will be a dedicated tool later (02-data-model §3.2).

const EDITABLE_FIELDS = ['full_name', 'first_name', 'last_name', 'email', 'language', 'notes']

function contactDisplayName(c) {
  return c?.full_name ||
    [c?.first_name, c?.last_name].filter(Boolean).join(' ') ||
    c?.email || 'Client sans nom'
}

export default function ContactDetailPage() {
  const { id } = useParams()
  const { currentTenantId } = useTenant()
  const navigate = useNavigate()
  const [contact, setContact] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [draft, setDraft] = useState({})

  useEffect(() => {
    if (!currentTenantId || !id) return
    let cancelled = false
    setLoading(true)
    api.getContact(currentTenantId, id)
      .then(c => {
        if (cancelled) return
        if (!c) setError('Client introuvable')
        else { setContact(c); setDraft(extractDraft(c)) }
        setLoading(false)
      })
      .catch(err => { if (!cancelled) { setError(err.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [currentTenantId, id])

  function extractDraft(c) {
    const d = {}
    for (const f of EDITABLE_FIELDS) d[f] = c[f] ?? ''
    return d
  }

  function handleField(e) {
    setDraft(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSave(e) {
    e.preventDefault()
    setError(null)
    const patch = {}
    for (const f of EDITABLE_FIELDS) {
      const next = draft[f] === '' ? null : draft[f]
      const prev = contact[f] ?? null
      if (next !== prev) patch[f] = next
    }
    if (Object.keys(patch).length === 0) { setEditing(false); return }
    setSubmitting(true)
    try {
      await api.updateContact(currentTenantId, id, patch)
      const refreshed = await api.getContact(currentTenantId, id)
      setContact(refreshed)
      setDraft(extractDraft(refreshed))
      setEditing(false)
    } catch (err) {
      setError(err.message || 'Erreur lors de la mise à jour.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="p-8 text-gray-500">Chargement…</div>
  if (error && !contact) return <div className="p-8 text-red-600">{error}</div>
  if (!contact) return null

  const channelColumns = [
    { key: 'channel_type', label: 'Type' },
    { key: 'channel_value', label: 'Valeur' },
    { key: 'is_primary', label: 'Principal', render: v => v ? '✅' : '' },
  ]

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={contactDisplayName(contact)}
        subtitle={`ID: ${contact.id}`}
        action={
          <div className="flex gap-2">
            {!editing && <Button onClick={() => setEditing(true)}>Modifier</Button>}
            <Button variant="secondary" onClick={() => navigate(-1)}>← Retour</Button>
          </div>
        }
      />

      <StatusBadge status={contact.status} />

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {/* Profile */}
      <div className="bg-white border rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold text-gray-700 mb-4">Profil</h3>
        {editing ? (
          <form onSubmit={handleSave} className="grid grid-cols-2 gap-4">
            {EDITABLE_FIELDS.map(f => (
              <FormField key={f} label={f} name={f} value={draft[f] ?? ''} onChange={handleField} />
            ))}
            <div className="col-span-2 flex gap-3">
              <Button type="submit" disabled={submitting}>{submitting ? 'Sauvegarde…' : 'Sauvegarder'}</Button>
              <Button variant="secondary" type="button" onClick={() => { setEditing(false); setDraft(extractDraft(contact)) }}>Annuler</Button>
            </div>
          </form>
        ) : (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {EDITABLE_FIELDS.map(f => (
              <div key={f}>
                <dt className="text-gray-500 capitalize">{f.replace(/_/g, ' ')}</dt>
                <dd className="text-gray-900">{contact[f] ?? '—'}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {/* Channels */}
      <div className="bg-white border rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold text-gray-700 mb-3">Canaux</h3>
        <DataTable
          columns={channelColumns}
          data={contact.channels ?? []}
          emptyMessage="Aucun canal associé."
        />
      </div>
    </div>
  )
}
