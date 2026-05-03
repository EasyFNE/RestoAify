import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PageHeader from '../../components/PageHeader.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import Button from '../../components/Button.jsx'
import { api } from '../../services/api.js'
import { useTenant } from '../../hooks/useTenant.js'

// Read-only conversation viewer.
// Sending replies will be handled later via channel_send_requests + the
// outbound n8n workflow (05-business-rules §2.5). This page only displays.

function contactDisplayName(contact) {
  if (!contact) return 'Contact inconnu'
  return contact.full_name ||
    [contact.first_name, contact.last_name].filter(Boolean).join(' ') ||
    contact.email ||
    'Contact inconnu'
}

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function MessageBubble({ msg }) {
  const inbound = msg.direction === 'inbound'
  return (
    <div className={`flex ${inbound ? 'justify-start' : 'justify-end'} mb-2`}>
      <div
        className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm shadow-sm ${
          inbound
            ? 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'
            : 'bg-indigo-600 text-white rounded-tr-none'
        }`}
      >
        <p>{msg.normalized_text || '(message sans texte)'}</p>
        <p className={`text-xs mt-1 ${inbound ? 'text-gray-400' : 'text-indigo-200'}`}>
          {formatTime(msg.created_at)}
        </p>
      </div>
    </div>
  )
}

export default function ConversationDetailPage() {
  const { id } = useParams()
  const { currentTenantId } = useTenant()
  const navigate = useNavigate()
  const [conv, setConv] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!currentTenantId || !id) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      api.getConversation(currentTenantId, id),
      api.listMessages(currentTenantId, id),
    ]).then(([c, msgs]) => {
      if (cancelled) return
      if (!c) setError('Conversation introuvable')
      else {
        setConv(c)
        setMessages(msgs)
      }
      setLoading(false)
    }).catch(err => {
      if (!cancelled) { setError(err.message); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [currentTenantId, id])

  if (loading) return <div className="p-8 text-gray-500">Chargement…</div>
  if (error) return <div className="p-8 text-red-600">{error}</div>
  if (!conv) return null

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title={`Conversation — ${contactDisplayName(conv.contact)}`}
        subtitle={`Canal: ${conv.channel?.channel_type ?? '—'} · Statut: ${conv.status}`}
        action={
          <Button variant="secondary" onClick={() => navigate(-1)}>← Retour</Button>
        }
      />

      {/* Meta */}
      <div className="flex items-center gap-3 text-sm text-gray-600">
        <StatusBadge status={conv.status} />
        {conv.current_context_type && (
          <span className="bg-gray-100 px-2 py-0.5 rounded text-xs">
            Contexte : {conv.current_context_type}
          </span>
        )}
      </div>

      {/* Message thread */}
      <div className="bg-gray-50 rounded-xl p-4 min-h-[300px] max-h-[60vh] overflow-y-auto space-y-1">
        {messages.length === 0 && (
          <p className="text-gray-400 text-sm text-center pt-8">Aucun message.</p>
        )}
        {messages.map(m => <MessageBubble key={m.id} msg={m} />)}
      </div>

      <p className="text-xs text-gray-400">
        💬 La réponse sortante est gérée via{' '}
        <code>channel_send_requests</code>{' '}
        et le workflow n8n outbound (v1.5).
      </p>
    </div>
  )
}
