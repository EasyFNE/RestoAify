import { useEffect, useState } from 'react'
import PageHeader from '../../components/PageHeader.jsx'
import Button from '../../components/Button.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { api } from '../../services/api.js'
import { useTenant } from '../../hooks/useTenant.js'
import { cn } from '../../lib/cn.js'


// ─────────────────────────────────────────────────────────────────────────────────
// Configuration des onglets — source unique de vérité.
// status: 'active' = implémenté, 'v1_5'|'v2' = à venir (rendu disabled).
// ─────────────────────────────────────────────────────────────────────────────────
const SETTINGS_TABS = [
  // Organisation
  { group: 'Organisation', key: 'general',           label: 'Général',                  status: 'active' },
  { group: 'Organisation', key: 'branding',          label: 'Marque & identité',        status: 'v1_5' },
  { group: 'Organisation', key: 'localization',      label: 'Localisation',             status: 'v1_5' },
  // Métier
  { group: 'Métier',       key: 'business_rules',    label: 'Règles métier par défaut', status: 'v1_5' },
  { group: 'Métier',       key: 'message_templates', label: 'Modèles de messages',      status: 'v1_5' },
  { group: 'Métier',       key: 'agent',             label: 'Agent IA & conversations', status: 'v1_5' },
  // Connectivité
  { group: 'Connectivité', key: 'channels',          label: 'Canaux de communication',  status: 'v1_5' },
  { group: 'Connectivité', key: 'integrations',      label: 'Intégrations externes',    status: 'v1_5' },
  { group: 'Connectivité', key: 'api_webhooks',      label: 'API & Webhooks',           status: 'v2'   },
  // Gouvernance
  { group: 'Gouvernance',  key: 'notifications',     label: 'Notifications internes',   status: 'v1_5' },
  { group: 'Gouvernance',  key: 'security',          label: 'Sécurité',                 status: 'v1_5' },
  { group: 'Gouvernance',  key: 'data_privacy',      label: 'Données & RGPD',           status: 'v2'   },
]


const GROUP_ORDER = ['Organisation', 'Métier', 'Connectivité', 'Gouvernance']


// Métadonnées affichées sur les onglets non implémentés.
const PLACEHOLDERS = {
  branding: {
    description: 'Logo, palette de couleurs et identité visuelle de votre marque.',
    upcoming: ['Logo (PNG/SVG)', 'Couleur primaire & secondaire', 'Favicon', 'Nom expéditeur emails'],
  },
  localization: {
    description: 'Langues supportées par l’agent et formats régionaux par défaut.',
    upcoming: ['Langue par défaut', 'Langues supportées', 'Fuseau horaire par défaut', 'Format de date'],
  },
  business_rules: {
    description: 'Valeurs par défaut Orders / Reservations / Catering / Healthy, héritées par les restaurants.',
    upcoming: [
      'Politique d’annulation',
      'Capacité par créneau',
      'Types de commande autorisés',
      'Politique d’abonnement',
    ],
  },
  message_templates: {
    description: 'Modèles des messages sortants envoyés par l’agent (confirmations, rappels, annulations).',
    upcoming: ['Confirmations de commande', 'Rappels de réservation', 'Annulations', 'Notifications de statut'],
  },
  agent: {
    description: 'Persona, ton et règles de handoff de l’agent IA conversationnel.',
    upcoming: ['Persona / ton', 'Mots-clés handoff', 'Seuil de confiance', 'Comportement hors heures'],
  },
  channels: {
    description: 'Canaux de communication (WhatsApp, …) connectés au tenant.',
    upcoming: ['Type de canal', 'Provider', 'Identifiant externe', 'Restaurant rattaché'],
  },
  integrations: {
    description: 'Connecteurs externes : POS, paiement, livraison.',
    upcoming: ['Paiement (Stripe, …)', 'Livraison (Uber Direct, Glovo)', 'POS partenaires', 'Mappings'],
  },
  api_webhooks: {
    description: 'Clés API et webhooks sortants pour vos intégrations techniques.',
    upcoming: ['Clés API par scope', 'Webhooks par événement', 'Secrets de signature', 'Tests de livraison'],
  },
  notifications: {
    description: 'Alertes internes : escalades, échecs workflow, événements critiques.',
    upcoming: ['Règles par événement', 'Canal de notification', 'Destinataires', 'Seuils'],
  },
  security: {
    description: 'Sécurité et politique d’accès du tenant.',
    upcoming: ['MFA obligatoire', 'Durée de session', 'Sessions actives', 'Allowlist IP'],
  },
  data_privacy: {
    description: 'Conformité RGPD : rétention, export, suppression.',
    upcoming: ['Rétention des messages', 'Rétention de l’audit', 'Export complet', 'Demande de suppression'],
  },
}


// ─────────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [activeKey, setActiveKey] = useState('general')
  const activeTab = SETTINGS_TABS.find(t => t.key === activeKey) || SETTINGS_TABS[0]


  return (
    <div>
      <PageHeader title="Paramètres" subtitle="Configuration de votre tenant" />


      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 items-start">
        <SettingsSidebar activeKey={activeKey} onSelect={setActiveKey} />


        <div className="min-w-0">
          {activeTab.status === 'active'
            ? <GeneralTab />
            : <PlaceholderTab tab={activeTab} />}
        </div>
      </div>
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────────────────────────────────────────
function SettingsSidebar({ activeKey, onSelect }) {
  return (
    <aside className="card p-2 md:sticky md:top-4 md:max-h-[calc(100vh-6rem)] overflow-y-auto">
      {GROUP_ORDER.map(group => {
        const items = SETTINGS_TABS.filter(t => t.group === group)
        return (
          <div key={group} className="mb-3 last:mb-0">
            <div className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {group}
            </div>
            <ul className="space-y-0.5">
              {items.map(t => (
                <SidebarItem
                  key={t.key}
                  tab={t}
                  active={t.key === activeKey}
                  onClick={() => onSelect(t.key)}
                />
              ))}
            </ul>
          </div>
        )
      })}
    </aside>
  )
}


function SidebarItem({ tab, active, onClick }) {
  const isDisabled = tab.status !== 'active'
  return (
    <li>
      <button
        type="button"
        onClick={isDisabled ? undefined : onClick}
        disabled={isDisabled}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors',
          active && 'bg-brand-50 text-brand-700 font-medium',
          !active && !isDisabled && 'text-gray-700 hover:bg-gray-50',
          isDisabled && 'text-gray-400 cursor-not-allowed',
        )}
      >
        <span className="truncate">{tab.label}</span>
        {isDisabled && <VersionPill status={tab.status} />}
      </button>
    </li>
  )
}


function VersionPill({ status }) {
  const label = status === 'v2' ? 'v2' : 'v1.5'
  return (
    <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
      {label}
    </span>
  )
}


// ─────────────────────────────────────────────────────────────────────────────────
// Onglet "Général" — seul implémenté en v1
// ─────────────────────────────────────────────────────────────────────────────────
function GeneralTab() {
  const { currentTenant, currentTenantId } = useTenant()
  const [plans, setPlans] = useState([])
  const [form, setForm] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)


  // Charge les plans pour afficher le nom (et non l'UUID).
  useEffect(() => {
    let cancelled = false
    api.listPlans()
      .then(d => { if (!cancelled) setPlans(d || []) })
      .catch(() => { if (!cancelled) setPlans([]) })
    return () => { cancelled = true }
  }, [])


  // Hydrate / rehydrate le formulaire dès que le tenant courant change.
  useEffect(() => {
    if (currentTenant) {
      setForm({ name: currentTenant.name || '' })
      setError(null)
      setSuccess(null)
    }
  }, [currentTenant])


  if (!currentTenant || !form) {
    return <div className="card p-6 text-gray-500">Chargement…</div>
  }


  const dirty = form.name.trim() !== (currentTenant.name || '').trim()
  const plan = plans.find(p => p.id === currentTenant.plan_id)


  function handleReset() {
    setForm({ name: currentTenant.name || '' })
    setError(null)
    setSuccess(null)
  }


  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    const trimmed = form.name.trim()
    if (!trimmed) {
      setError('Le nom est obligatoire.')
      return
    }
    setSubmitting(true)
    try {
      await api.updateTenant(currentTenantId, { name: trimmed })
      setSuccess('Paramètres enregistrés.')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err?.message || 'Erreur lors de l’enregistrement.')
    } finally {
      setSubmitting(false)
    }
  }


  async function copyId() {
    try {
      await navigator.clipboard.writeText(currentTenantId)
      setSuccess('Identifiant copié.')
      setTimeout(() => setSuccess(null), 1500)
    } catch {
      setError('Impossible de copier l’identifiant.')
    }
  }


  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* En-tête de section */}
      <div className="card p-5">
        <h2 className="text-base font-semibold text-gray-900">Général</h2>
        <p className="text-sm text-gray-500 mt-1">Identité de votre organisation.</p>
      </div>


      {/* Bandeaux feedback (en haut, plus visibles que tout en bas) */}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          {success}
        </div>
      )}


      {/* Section éditable */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Informations modifiables</h3>
        <p className="text-xs text-gray-500 mb-4">Ces champs peuvent être édités à tout moment.</p>


        <div className="max-w-xl">
          <label htmlFor="tenant-name" className="block text-xs font-medium text-gray-700 mb-1">
            Nom <span className="text-red-500">*</span>
          </label>
          <input
            id="tenant-name"
            name="name"
            type="text"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            required
            disabled={submitting}
            placeholder="Le nom de votre organisation"
            className="input"
          />
          <p className="text-xs text-gray-500 mt-1">
            Affiché dans le backoffice et dans les notifications envoyées à votre équipe.
          </p>
        </div>
      </div>


      {/* Section read-only — gérée par la plateforme */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Informations système</h3>
        <p className="text-xs text-gray-500 mb-4">
          Ces informations sont gérées par la plateforme et ne sont pas modifiables ici.
        </p>


        <dl className="divide-y divide-gray-100 -my-2">
          <RoRow label="Slug">
            <code className="text-xs text-gray-700 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">
              {currentTenant.slug}
            </code>
          </RoRow>


          <RoRow label="Plan">
            {plan ? (
              <span className="text-gray-900">{plan.name}</span>
            ) : (
              <span className="text-gray-400">—</span>
            )}
          </RoRow>


          <RoRow label="Statut">
            <StatusBadge status={currentTenant.status} />
          </RoRow>


          <RoRow label="Identifiant">
            <div className="flex items-center gap-2 min-w-0">
              <code
                className="text-xs text-gray-700 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200 truncate"
                title={currentTenantId}
              >
                {currentTenantId}
              </code>
              <button
                type="button"
                onClick={copyId}
                className="shrink-0 text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                Copier
              </button>
            </div>
          </RoRow>


          <RoRow label="Créé le">{formatDate(currentTenant.created_at)}</RoRow>


          <RoRow label="Mis à jour le">{formatDate(currentTenant.updated_at)}</RoRow>
        </dl>
      </div>


      {/* Actions */}
      <div className="flex justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="secondary"
          onClick={handleReset}
          disabled={!dirty || submitting}
        >
          Annuler
        </Button>
        <Button type="submit" disabled={!dirty || submitting}>
          {submitting ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>
    </form>
  )
}


// Ligne d'une définition list read-only (label gauche, valeur droite).
function RoRow({ label, children }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 py-2.5 items-center">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900 min-w-0">{children}</dd>
    </div>
  )
}


function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}


// ─────────────────────────────────────────────────────────────────────────────────
// Onglets non implémentés — placeholder propre, identique pour tous
// ─────────────────────────────────────────────────────────────────────────────────
function PlaceholderTab({ tab }) {
  const meta = PLACEHOLDERS[tab.key] || { description: '', upcoming: [] }
  const versionLabel = tab.status === 'v2' ? 'v2' : 'v1.5'


  return (
    <div className="card p-6">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900">{tab.label}</h2>
          <p className="text-sm text-gray-600 mt-1 max-w-prose">{meta.description}</p>
        </div>
        <span className="shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
          Bientôt — {versionLabel}
        </span>
      </div>


      {meta.upcoming.length > 0 && (
        <div className="mt-5 pt-5 border-t border-gray-100">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
            Champs prévus
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {meta.upcoming.map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-gray-500">
                <span className="w-1 h-1 rounded-full bg-gray-300" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
