import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../../components/PageHeader.jsx'
import Button from '../../components/Button.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { api } from '../../services/api.js'
import { useTenant } from '../../hooks/useTenant.js'
import { cn } from '../../lib/cn.js'

// ─────────────────────────────────────────────────────────────────────────────
// Configuration des onglets — source unique de vérité.
//
// backed: 'supabase'  → persisté via api.* (Supabase + audit_logs)
//         'partial'   → lecture Supabase, écriture non encore exposée
//         'preview'   → persistance locale (localStorage scopé par tenantId)
//
// La clé de stockage inclut le tenantId : rien ne fuit entre tenants (règle 01).
// ─────────────────────────────────────────────────────────────────────────────
const SETTINGS_TABS = [
  // Organisation
  { group: 'Organisation', key: 'general',           label: 'Général',                  backed: 'supabase' },
  { group: 'Organisation', key: 'branding',          label: 'Marque & identité',        backed: 'preview'  },
  { group: 'Organisation', key: 'localization',      label: 'Localisation',             backed: 'preview'  },
  // Métier
  { group: 'Métier',       key: 'business_rules',    label: 'Règles métier par défaut', backed: 'preview'  },
  { group: 'Métier',       key: 'message_templates', label: 'Modèles de messages',      backed: 'preview'  },
  { group: 'Métier',       key: 'agent',             label: 'Agent IA & conversations', backed: 'preview'  },
  // Connectivité
  { group: 'Connectivité', key: 'channels',          label: 'Canaux de communication',  backed: 'partial'  },
  { group: 'Connectivité', key: 'integrations',      label: 'Intégrations externes',    backed: 'preview'  },
  { group: 'Connectivité', key: 'api_webhooks',      label: 'API & Webhooks',           backed: 'preview'  },
  // Gouvernance
  { group: 'Gouvernance',  key: 'notifications',     label: 'Notifications internes',   backed: 'preview'  },
  { group: 'Gouvernance',  key: 'security',          label: 'Sécurité',                 backed: 'preview'  },
  { group: 'Gouvernance',  key: 'data_privacy',      label: 'Données & RGPD',           backed: 'preview'  },
]

const GROUP_ORDER = ['Organisation', 'Métier', 'Connectivité', 'Gouvernance']

// ─────────────────────────────────────────────────────────────────────────────
// Defaults des sections preview
// ─────────────────────────────────────────────────────────────────────────────
const BRANDING_DEFAULTS = {
  logo_url: '',
  favicon_url: '',
  primary_color: '#2563eb',
  secondary_color: '#1d4ed8',
  email_sender_name: '',
  tagline: '',
  website_url: '',
}

const LOCALIZATION_DEFAULTS = {
  default_language: 'fr',
  supported_languages: ['fr'],
  default_timezone: 'Africa/Abidjan',
  default_currency: 'XOF',
  date_format: 'DD/MM/YYYY',
  time_format: '24h',
  first_day_of_week: 'monday',
}

const BUSINESS_RULES_DEFAULTS = {
  service_hours_start: '08:00',
  service_hours_end: '23:00',
  allowed_service_types: ['delivery', 'pickup', 'dine_in'],
  min_lead_time_minutes: 30,
  max_advance_days: 7,
  min_order_amount: 0,
  default_reservation_duration_min: 90,
  default_capacity_per_slot: 4,
  reservation_cancellation_window_hours: 2,
  reservation_cancellation_fee_pct: 0,
  catering_min_lead_time_hours: 48,
  catering_min_guests: 10,
  default_subscription_duration_days: 30,
  allow_subscription_pause: true,
}

const MESSAGE_TEMPLATE_DEFAULTS = {
  welcome:               'Bonjour {{tenant_name}} ! Comment puis-je vous aider aujourd\'hui ?',
  order_confirmation:    'Bonjour {{contact_name}}, votre commande {{order_number}} est confirmée pour {{requested_for}}. Total : {{total_amount}}.',
  order_ready:           'Bonjour {{contact_name}}, votre commande {{order_number}} est prête. {{service_context}}',
  reservation_reminder:  'Rappel : votre réservation chez {{restaurant_name}} est prévue pour {{requested_for}}. À très vite !',
  reservation_cancelled: 'Votre réservation du {{requested_for}} a été annulée. {{cancellation_reason}}',
  handoff_notice:        'Un membre de l\'équipe va prendre le relais pour vous répondre. Merci de votre patience.',
}

const AGENT_DEFAULTS = {
  persona: 'Tu es l\'assistant conversationnel d\'un restaurant chaleureux et professionnel. Tu es concis, tu réponds dans la langue du client, et tu n\'inventes pas d\'informations.',
  tone: 'warm',
  confidence_threshold: 0.65,
  off_hours_behavior: 'handoff',
  active_hours_start: '08:00',
  active_hours_end: '23:00',
  handoff_keywords: 'humain, parler à quelqu\'un, urgence, plainte, allergie',
  enable_long_term_memory: true,
  max_messages_per_session: 50,
  enable_voice_transcription: true,
}

const INTEGRATIONS_DEFAULTS = {
  stripe_enabled: false,
  stripe_account_id: '',
  mobile_money_enabled: false,
  mobile_money_provider: 'wave',
  uber_direct_enabled: false,
  glovo_enabled: false,
  yango_enabled: false,
  pos_provider: '',
  pos_external_id: '',
  hubspot_enabled: false,
}

const API_WEBHOOKS_DEFAULTS = {
  webhook_url: '',
  webhook_secret: '',
  events: {
    order_created: true,
    order_status_changed: true,
    reservation_created: false,
    reservation_cancelled: false,
    contact_created: false,
    handoff_requested: true,
  },
  retry_on_failure: true,
  max_retries: 3,
}

const NOTIFICATIONS_DEFAULTS = {
  channel_preference: 'both',
  digest_frequency: 'realtime',
  notify_workflow_failure: true,
  notify_channel_error: true,
  notify_new_handoff: true,
  notify_high_value_order: false,
}

const SECURITY_DEFAULTS = {
  require_mfa: false,
  session_duration_hours: 12,
  ip_allow_list: '',
  password_rotation_days: 0,
  enforce_sso: false,
  sso_provider: '',
  sso_domain: '',
}

const DATA_PRIVACY_DEFAULTS = {
  data_retention_days: 365,
  auto_anonymize_contacts: false,
  allow_export_requests: true,
  legal_contact_email: '',
  consent_message: '',
}

// ─────────────────────────────────────────────────────────────────────────────
// Options de sélection
// ─────────────────────────────────────────────────────────────────────────────
const LANGUAGE_OPTIONS = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'Anglais' },
  { value: 'es', label: 'Espagnol' },
  { value: 'pt', label: 'Portugais' },
  { value: 'ar', label: 'Arabe' },
]

const TIMEZONE_OPTIONS = [
  'Africa/Abidjan',
  'Africa/Dakar',
  'Africa/Lagos',
  'Africa/Casablanca',
  'Europe/Paris',
  'UTC',
]

const CURRENCY_OPTIONS = [
  { value: 'XOF', label: 'Franc CFA (XOF)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'USD', label: 'Dollar US (USD)' },
  { value: 'MAD', label: 'Dirham marocain (MAD)' },
  { value: 'GHS', label: 'Cedi ghanéen (GHS)' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook — persistance locale scopée par tenant + section
// ─────────────────────────────────────────────────────────────────────────────
function usePreviewSettings(tenantId, section, defaults) {
  const storageKey = tenantId ? `rsaas.settings.${tenantId}.${section}` : null
  const [savedValue, setSavedValue] = useState(defaults)
  const [draft, setDraft] = useState(defaults)

  useEffect(() => {
    if (!storageKey) {
      setSavedValue(defaults)
      setDraft(defaults)
      return
    }
    try {
      const raw = localStorage.getItem(storageKey)
      const next = raw ? { ...defaults, ...JSON.parse(raw) } : defaults
      setSavedValue(next)
      setDraft(next)
    } catch {
      setSavedValue(defaults)
      setDraft(defaults)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(savedValue),
    [draft, savedValue],
  )

  function save() {
    if (!storageKey) return
    localStorage.setItem(storageKey, JSON.stringify(draft))
    setSavedValue(draft)
  }

  function reset() {
    setDraft(savedValue)
  }

  function patch(next) {
    setDraft(prev => ({ ...prev, ...next }))
  }

  return { draft, patch, setDraft, save, reset, dirty }
}

// ─────────────────────────────────────────────────────────────────────────────
// Page principale
// ─────────────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [activeKey, setActiveKey] = useState('general')
  const activeTab = SETTINGS_TABS.find(t => t.key === activeKey) || SETTINGS_TABS[0]

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Paramètres"
        subtitle="Configuration du tenant, des règles métier et des intégrations."
      />
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 items-start">
        <SettingsSidebar activeKey={activeKey} onSelect={setActiveKey} />
        <div className="min-w-0">{renderTab(activeTab)}</div>
      </div>
    </div>
  )
}

function renderTab(tab) {
  switch (tab.key) {
    case 'general':           return <GeneralTab />
    case 'branding':          return <BrandingTab />
    case 'localization':      return <LocalizationTab />
    case 'business_rules':    return <BusinessRulesTab />
    case 'message_templates': return <MessageTemplatesTab />
    case 'agent':             return <AgentTab />
    case 'channels':          return <ChannelsTab />
    case 'integrations':      return <IntegrationsTab />
    case 'api_webhooks':      return <ApiWebhooksTab />
    case 'notifications':     return <NotificationsTab />
    case 'security':          return <SecurityTab />
    case 'data_privacy':      return <DataPrivacyTab />
    default:                  return <GeneralTab />
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────────────────────────────────────
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
              {items.map(tab => (
                <SidebarItem
                  key={tab.key}
                  tab={tab}
                  active={tab.key === activeKey}
                  onClick={() => onSelect(tab.key)}
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
  const isPreview = tab.backed !== 'supabase'
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors',
          active
            ? 'bg-brand-50 text-brand-700 font-medium'
            : 'text-gray-700 hover:bg-gray-50',
        )}
      >
        <span className="truncate">{tab.label}</span>
        {isPreview && (
          <span
            className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-400"
            title={tab.backed === 'partial' ? 'Lecture seule Supabase' : 'Aperçu local'}
          />
        )}
      </button>
    </li>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Primitives UI partagées
// ─────────────────────────────────────────────────────────────────────────────
function SectionHeader({ title, description, badge = null }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {description ? <p className="text-sm text-gray-500 mt-1">{description}</p> : null}
        </div>
        {badge}
      </div>
    </div>
  )
}

function PreviewBadge({ label = 'Aperçu' }) {
  return (
    <span className="shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
      {label}
    </span>
  )
}

function PreviewBanner({ version = 'v1.5' }) {
  return (
    <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
      <strong className="font-semibold">Aperçu de la section.</strong>{' '}
      Vos modifications sont conservées localement sur cet appareil. La synchronisation backend
      sera activée avec les modules dédiés en {version}.
    </div>
  )
}

function Banner({ kind = 'info', children }) {
  const styles = {
    info:    'bg-blue-50 border-blue-200 text-blue-800',
    success: 'bg-green-50 border-green-200 text-green-800',
    error:   'bg-red-50 border-red-200 text-red-700',
  }
  return (
    <div className={cn('rounded-md border px-4 py-3 text-sm', styles[kind])}>
      {children}
    </div>
  )
}

function FormCard({ title, description, children }) {
  return (
    <div className="card p-5">
      {title ? <h3 className="text-sm font-semibold text-gray-900 mb-1">{title}</h3> : null}
      {description ? <p className="text-xs text-gray-500 mb-4">{description}</p> : null}
      <div>{children}</div>
    </div>
  )
}

function Field({ label, htmlFor, hint, required, className, children }) {
  return (
    <div className={className}>
      {label ? (
        <label htmlFor={htmlFor} className="block text-xs font-medium text-gray-700 mb-1">
          {label}
          {required ? <span className="text-red-500 ml-0.5">*</span> : null}
        </label>
      ) : null}
      {children}
      {hint ? <p className="text-xs text-gray-500 mt-1">{hint}</p> : null}
    </div>
  )
}

function TextInput({ id, ...props }) {
  return <input id={id} type="text" className="input" {...props} />
}

function SelectInput({ id, options = [], placeholder = 'Sélectionner', ...props }) {
  return (
    <select id={id} className="input" {...props}>
      <option value="">{placeholder}</option>
      {options.map(option => {
        if (typeof option === 'string') {
          return <option key={option} value={option}>{option}</option>
        }
        return <option key={option.value} value={option.value}>{option.label}</option>
      })}
    </select>
  )
}

function Textarea({ id, rows = 4, ...props }) {
  return <textarea id={id} rows={rows} className="input" {...props} />
}

function Toggle({ checked, onChange, label }) {
  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1',
          checked ? 'bg-brand-600' : 'bg-gray-200',
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0',
          )}
        />
      </button>
      {label ? <span className="text-sm text-gray-700">{label}</span> : null}
    </div>
  )
}

function CheckboxGroup({ value = [], options = [], onChange }) {
  function toggle(v) {
    if (value.includes(v)) onChange(value.filter(x => x !== v))
    else onChange([...value, v])
  }
  return (
    <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
      {options.map(option => {
        const opt = typeof option === 'string' ? { value: option, label: option } : option
        return (
          <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-800">
            <input
              type="checkbox"
              checked={value.includes(opt.value)}
              onChange={() => toggle(opt.value)}
              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <span>{opt.label}</span>
          </label>
        )
      })}
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 py-2.5 items-center">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900 min-w-0">{children}</dd>
    </div>
  )
}

function ActionFooter({ dirty, submitting, onReset }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <Button type="button" variant="secondary" onClick={onReset} disabled={!dirty || submitting}>
        Annuler
      </Button>
      <Button type="submit" disabled={!dirty || submitting}>
        {submitting ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Wrapper générique pour les onglets preview
// ─────────────────────────────────────────────────────────────────────────────
function PreviewTab({ section, defaults, version, title, description, children }) {
  const { currentTenantId } = useTenant()
  const settings = usePreviewSettings(currentTenantId, section, defaults)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(null)

  async function handleSave(e) {
    e.preventDefault()
    setSubmitting(true)
    await new Promise(resolve => setTimeout(resolve, 120))
    settings.save()
    setSuccess('Paramètres enregistrés localement.')
    setSubmitting(false)
    setTimeout(() => setSuccess(null), 2500)
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <SectionHeader title={title} description={description} badge={<PreviewBadge />} />
      <PreviewBanner version={version} />
      {success ? <Banner kind="success">{success}</Banner> : null}
      {typeof children === 'function' ? children(settings) : children}
      <ActionFooter dirty={settings.dirty} submitting={submitting} onReset={settings.reset} />
    </form>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet Général — Supabase
// ─────────────────────────────────────────────────────────────────────────────
function GeneralTab() {
  const { currentTenant, currentTenantId } = useTenant()
  const [plans, setPlans]       = useState([])
  const [form, setForm]         = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]       = useState(null)
  const [success, setSuccess]   = useState(null)

  useEffect(() => {
    let cancelled = false
    api.listPlans()
      .then(d => { if (!cancelled) setPlans(d || []) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

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
  const plan  = plans.find(p => p.id === currentTenant.plan_id)

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
    if (!trimmed) { setError('Le nom est obligatoire.'); return }
    setSubmitting(true)
    try {
      await api.updateTenant(currentTenantId, { name: trimmed })
      setSuccess('Paramètres enregistrés.')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err?.message || 'Erreur lors de l\'enregistrement.')
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
      setError('Impossible de copier l\'identifiant.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <SectionHeader title="Général" description="Identité de votre organisation." />

      {error   ? <Banner kind="error">{error}</Banner>     : null}
      {success ? <Banner kind="success">{success}</Banner> : null}

      <FormCard
        title="Informations modifiables"
        description="Ces champs peuvent être édités à tout moment."
      >
        <div className="max-w-xl">
          <Field label="Nom" htmlFor="tenant-name" required hint="Affiché dans le backoffice et dans les notifications.">
            <TextInput
              id="tenant-name"
              name="name"
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              disabled={submitting}
              placeholder="Nom de votre organisation"
            />
          </Field>
        </div>
      </FormCard>

      <FormCard
        title="Informations système"
        description="Ces informations sont gérées par la plateforme et ne sont pas modifiables ici."
      >
        <dl className="divide-y divide-gray-100 -my-2">
          <Row label="Slug">
            <code className="text-xs text-gray-700 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">
              {currentTenant.slug}
            </code>
          </Row>
          <Row label="Plan">
            {plan ? <span>{plan.name}</span> : <span className="text-gray-400">—</span>}
          </Row>
          <Row label="Statut">
            <StatusBadge status={currentTenant.status} />
          </Row>
          <Row label="Identifiant">
            <div className="flex items-center gap-2 min-w-0">
              <code className="text-xs text-gray-700 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200 truncate" title={currentTenantId}>
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
          </Row>
          <Row label="Créé le">{formatDate(currentTenant.created_at)}</Row>
          <Row label="Mis à jour le">{formatDate(currentTenant.updated_at)}</Row>
        </dl>
      </FormCard>

      <ActionFooter dirty={dirty} submitting={submitting} onReset={handleReset} />
    </form>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet Marque & identité
// ─────────────────────────────────────────────────────────────────────────────
function BrandingTab() {
  return (
    <PreviewTab
      section="branding"
      defaults={BRANDING_DEFAULTS}
      version="v1.5"
      title="Marque & identité"
      description="Logo, palette de couleurs et identité visuelle du tenant."
    >
      {({ draft, patch }) => (
        <>
          <FormCard title="Visuels">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="URL du logo" htmlFor="logo_url">
                <TextInput
                  id="logo_url"
                  value={draft.logo_url}
                  onChange={e => patch({ logo_url: e.target.value })}
                  placeholder="https://.../logo.svg"
                />
              </Field>
              <Field label="URL du favicon" htmlFor="favicon_url">
                <TextInput
                  id="favicon_url"
                  value={draft.favicon_url}
                  onChange={e => patch({ favicon_url: e.target.value })}
                  placeholder="https://.../favicon.png"
                />
              </Field>
            </div>
          </FormCard>

          <FormCard title="Palette">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Couleur primaire" htmlFor="primary_color">
                <TextInput
                  id="primary_color"
                  value={draft.primary_color}
                  onChange={e => patch({ primary_color: e.target.value })}
                  placeholder="#2563eb"
                />
              </Field>
              <Field label="Couleur secondaire" htmlFor="secondary_color">
                <TextInput
                  id="secondary_color"
                  value={draft.secondary_color}
                  onChange={e => patch({ secondary_color: e.target.value })}
                  placeholder="#1d4ed8"
                />
              </Field>
            </div>
          </FormCard>

          <FormCard title="Identité textuelle">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nom expéditeur emails" htmlFor="email_sender_name">
                <TextInput
                  id="email_sender_name"
                  value={draft.email_sender_name}
                  onChange={e => patch({ email_sender_name: e.target.value })}
                  placeholder="Mon Restaurant"
                />
              </Field>
              <Field label="Site web" htmlFor="website_url">
                <TextInput
                  id="website_url"
                  value={draft.website_url}
                  onChange={e => patch({ website_url: e.target.value })}
                  placeholder="https://monrestaurant.com"
                />
              </Field>
              <Field label="Tagline" htmlFor="tagline" className="sm:col-span-2">
                <TextInput
                  id="tagline"
                  value={draft.tagline}
                  onChange={e => patch({ tagline: e.target.value })}
                  placeholder="La saveur à votre porte"
                />
              </Field>
            </div>
          </FormCard>
        </>
      )}
    </PreviewTab>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet Localisation
// ─────────────────────────────────────────────────────────────────────────────
function LocalizationTab() {
  return (
    <PreviewTab
      section="localization"
      defaults={LOCALIZATION_DEFAULTS}
      version="v1.5"
      title="Localisation"
      description="Langues, fuseau horaire et formats par défaut du tenant."
    >
      {({ draft, patch }) => (
        <>
          <FormCard title="Langues">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Langue par défaut" htmlFor="default_language">
                <SelectInput
                  id="default_language"
                  value={draft.default_language}
                  onChange={e => patch({ default_language: e.target.value })}
                  options={LANGUAGE_OPTIONS}
                  placeholder=""
                />
              </Field>
              <Field label="Langues supportées">
                <CheckboxGroup
                  value={draft.supported_languages}
                  onChange={v => patch({ supported_languages: v })}
                  options={LANGUAGE_OPTIONS}
                />
              </Field>
            </div>
          </FormCard>

          <FormCard title="Formats régionaux">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Fuseau horaire" htmlFor="default_timezone">
                <SelectInput
                  id="default_timezone"
                  value={draft.default_timezone}
                  onChange={e => patch({ default_timezone: e.target.value })}
                  options={TIMEZONE_OPTIONS}
                  placeholder=""
                />
              </Field>
              <Field label="Devise" htmlFor="default_currency">
                <SelectInput
                  id="default_currency"
                  value={draft.default_currency}
                  onChange={e => patch({ default_currency: e.target.value })}
                  options={CURRENCY_OPTIONS}
                  placeholder=""
                />
              </Field>
            </div>
          </FormCard>
        </>
      )}
    </PreviewTab>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet Règles métier
// ─────────────────────────────────────────────────────────────────────────────
function BusinessRulesTab() {
  return (
    <PreviewTab
      section="business_rules"
      defaults={BUSINESS_RULES_DEFAULTS}
      version="v1.5"
      title="Règles métier par défaut"
      description="Valeurs par défaut héritées par les restaurants du tenant."
    >
      {({ draft, patch }) => (
        <>
          <FormCard title="Heures de service">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
              <Field label="Ouverture par défaut" htmlFor="service_hours_start">
                <input
                  id="service_hours_start"
                  type="time"
                  className="input"
                  value={draft.service_hours_start}
                  onChange={e => patch({ service_hours_start: e.target.value })}
                />
              </Field>
              <Field label="Fermeture par défaut" htmlFor="service_hours_end">
                <input
                  id="service_hours_end"
                  type="time"
                  className="input"
                  value={draft.service_hours_end}
                  onChange={e => patch({ service_hours_end: e.target.value })}
                />
              </Field>
            </div>
          </FormCard>

          <FormCard title="Orders">
            <div className="space-y-4">
              <Field label="Types de commande autorisés">
                <CheckboxGroup
                  value={draft.allowed_service_types}
                  onChange={v => patch({ allowed_service_types: v })}
                  options={[
                    { value: 'delivery', label: 'Livraison' },
                    { value: 'pickup',   label: 'À emporter' },
                    { value: 'dine_in',  label: 'Sur place' },
                  ]}
                />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
                <Field label="Délai minimum (min)" htmlFor="min_lead_time_minutes">
                  <input
                    id="min_lead_time_minutes"
                    type="number" min="0" className="input"
                    value={draft.min_lead_time_minutes}
                    onChange={e => patch({ min_lead_time_minutes: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Réservation max (jours)" htmlFor="max_advance_days">
                  <input
                    id="max_advance_days"
                    type="number" min="1" className="input"
                    value={draft.max_advance_days}
                    onChange={e => patch({ max_advance_days: Number(e.target.value) })}
                  />
                </Field>
              </div>
            </div>
          </FormCard>

          <FormCard title="Réservations">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
              <Field label="Durée créneau (min)" htmlFor="default_reservation_duration_min">
                <input
                  id="default_reservation_duration_min"
                  type="number" min="15" className="input"
                  value={draft.default_reservation_duration_min}
                  onChange={e => patch({ default_reservation_duration_min: Number(e.target.value) })}
                />
              </Field>
              <Field label="Capacité par créneau" htmlFor="default_capacity_per_slot">
                <input
                  id="default_capacity_per_slot"
                  type="number" min="1" className="input"
                  value={draft.default_capacity_per_slot}
                  onChange={e => patch({ default_capacity_per_slot: Number(e.target.value) })}
                />
              </Field>
            </div>
          </FormCard>
        </>
      )}
    </PreviewTab>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet Modèles de messages
// ─────────────────────────────────────────────────────────────────────────────
const TEMPLATE_LABELS = {
  welcome:               'Message de bienvenue',
  order_confirmation:    'Confirmation de commande',
  order_ready:           'Commande prête',
  reservation_reminder:  'Rappel de réservation',
  reservation_cancelled: 'Annulation de réservation',
  handoff_notice:        'Transfert à un agent humain',
}

function MessageTemplatesTab() {
  return (
    <PreviewTab
      section="message_templates"
      defaults={MESSAGE_TEMPLATE_DEFAULTS}
      version="v1.5"
      title="Modèles de messages"
      description="Templates utilisés par les workflows et l'agent. Variables : {{tenant_name}}, {{contact_name}}, {{order_number}}, {{requested_for}}, {{total_amount}}, {{service_context}}, {{restaurant_name}}, {{cancellation_reason}}."
    >
      {({ draft, patch }) => (
        <FormCard title="Templates">
          <div className="space-y-5">
            {Object.entries(draft).map(([key, value]) => (
              <Field key={key} label={TEMPLATE_LABELS[key] || key} htmlFor={`tmpl_${key}`}>
                <Textarea
                  id={`tmpl_${key}`}
                  rows={3}
                  value={value}
                  onChange={e => patch({ [key]: e.target.value })}
                />
              </Field>
            ))}
          </div>
        </FormCard>
      )}
    </PreviewTab>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet Agent IA
// ─────────────────────────────────────────────────────────────────────────────
function AgentTab() {
  return (
    <PreviewTab
      section="agent"
      defaults={AGENT_DEFAULTS}
      version="v1.5"
      title="Agent IA & conversations"
      description="Persona, ton et règles d'escalade humaine de l'agent IA."
    >
      {({ draft, patch }) => (
        <>
          <FormCard title="Persona" description="Description envoyée au LLM comme system prompt.">
            <Field label="Description de l'agent">
              <Textarea
                rows={5}
                value={draft.persona}
                onChange={e => patch({ persona: e.target.value })}
              />
            </Field>
          </FormCard>

          <FormCard title="Comportement">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Ton" htmlFor="agent_tone">
                <SelectInput
                  id="agent_tone"
                  value={draft.tone}
                  onChange={e => patch({ tone: e.target.value })}
                  placeholder=""
                  options={[
                    { value: 'warm',         label: 'Chaleureux' },
                    { value: 'professional', label: 'Professionnel' },
                    { value: 'friendly',     label: 'Amical' },
                    { value: 'formal',       label: 'Formel' },
                  ]}
                />
              </Field>
              <Field label="Comportement hors heures" htmlFor="off_hours_behavior">
                <SelectInput
                  id="off_hours_behavior"
                  value={draft.off_hours_behavior}
                  onChange={e => patch({ off_hours_behavior: e.target.value })}
                  placeholder=""
                  options={[
                    { value: 'handoff', label: 'Transférer à un humain' },
                    { value: 'reply',   label: 'Répondre automatiquement' },
                    { value: 'ignore',  label: 'Ne pas répondre' },
                  ]}
                />
              </Field>
              <Field label="Heures d'activité (début)" htmlFor="active_hours_start">
                <input
                  id="active_hours_start"
                  type="time" className="input"
                  value={draft.active_hours_start}
                  onChange={e => patch({ active_hours_start: e.target.value })}
                />
              </Field>
              <Field label="Heures d'activité (fin)" htmlFor="active_hours_end">
                <input
                  id="active_hours_end"
                  type="time" className="input"
                  value={draft.active_hours_end}
                  onChange={e => patch({ active_hours_end: e.target.value })}
                />
              </Field>
            </div>
          </FormCard>

          <FormCard title="Handoff & limites">
            <div className="space-y-4">
              <Field label="Mots-clés de handoff" hint="Séparés par des virgules">
                <Textarea
                  rows={2}
                  value={draft.handoff_keywords}
                  onChange={e => patch({ handoff_keywords: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Seuil de confiance" htmlFor="confidence_threshold" hint="Entre 0 et 1">
                  <input
                    id="confidence_threshold"
                    type="number" step="0.05" min="0" max="1" className="input"
                    value={draft.confidence_threshold}
                    onChange={e => patch({ confidence_threshold: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Messages max / session" htmlFor="max_messages_per_session">
                  <input
                    id="max_messages_per_session"
                    type="number" min="1" max="200" className="input"
                    value={draft.max_messages_per_session}
                    onChange={e => patch({ max_messages_per_session: Number(e.target.value) })}
                  />
                </Field>
              </div>
              <Toggle
                checked={draft.enable_long_term_memory}
                onChange={v => patch({ enable_long_term_memory: v })}
                label="Activer la mémoire long terme"
              />
              <Toggle
                checked={draft.enable_voice_transcription}
                onChange={v => patch({ enable_voice_transcription: v })}
                label="Activer la transcription vocale"
              />
            </div>
          </FormCard>
        </>
      )}
    </PreviewTab>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet Canaux — lecture Supabase
// ─────────────────────────────────────────────────────────────────────────────
function ChannelsTab() {
  const { currentTenantId } = useTenant()
  const [channels, setChannels]     = useState([])
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)

  useEffect(() => {
    if (!currentTenantId) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      api.listChannels(currentTenantId),
      api.listRestaurants(currentTenantId),
    ])
      .then(([c, r]) => {
        if (cancelled) return
        setChannels(c || [])
        setRestaurants(r || [])
      })
      .catch(err => { if (!cancelled) setError(err?.message || 'Erreur de chargement.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [currentTenantId])

  const restoById = useMemo(() => new Map(restaurants.map(r => [r.id, r])), [restaurants])

  async function copyWebhook() {
    const url = `https://api.enigma-sys.com/webhooks/inbound/${currentTenantId || ''}`
    try { await navigator.clipboard.writeText(url) } catch {}
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Canaux de communication"
        description="Canaux entrants connectés à votre tenant."
        badge={<PreviewBadge label="Partiel" />}
      />
      {error ? <Banner kind="error">{error}</Banner> : null}

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            {loading
              ? 'Chargement…'
              : `${channels.length} canal${channels.length > 1 ? 'aux' : ''}`}
          </h3>
          <Button variant="secondary" disabled title="La connexion nécessite une configuration côté plateforme.">
            Connecter un canal
          </Button>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-gray-500">Chargement…</div>
        ) : channels.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-gray-900 font-medium">Aucun canal connecté</div>
            <p className="text-sm text-gray-500 mt-1">
              La connexion d'un canal nécessite la configuration de secrets côté plateforme.
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-th">Type</th>
                <th className="table-th">Provider</th>
                <th className="table-th">Identifiant externe</th>
                <th className="table-th">Restaurant</th>
                <th className="table-th">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {channels.map(ch => (
                <tr key={ch.id}>
                  <td className="table-td font-medium text-gray-900">{ch.channel_type}</td>
                  <td className="table-td">{ch.provider || '—'}</td>
                  <td className="table-td">
                    <code className="text-xs text-gray-700 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">
                      {ch.external_channel_id || '—'}
                    </code>
                  </td>
                  <td className="table-td">
                    {restoById.get(ch.restaurant_id)?.name ||
                      (ch.restaurant_id
                        ? <code className="text-xs">{ch.restaurant_id.slice(0, 8)}</code>
                        : '— (tenant)')}
                  </td>
                  <td className="table-td">
                    <StatusBadge status={ch.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <FormCard title="Webhook entrant">
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs text-gray-700 bg-gray-50 px-3 py-2 rounded border border-gray-200 truncate">
            {`https://api.enigma-sys.com/webhooks/inbound/${currentTenantId || ''}`}
          </code>
          <Button type="button" variant="secondary" onClick={copyWebhook} disabled={!currentTenantId}>
            Copier
          </Button>
        </div>
      </FormCard>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet Intégrations
// ─────────────────────────────────────────────────────────────────────────────
function IntegrationsTab() {
  return (
    <PreviewTab
      section="integrations"
      defaults={INTEGRATIONS_DEFAULTS}
      version="v2"
      title="Intégrations externes"
      description="Connecteurs vers des systèmes tiers : paiement, livraison, POS."
    >
      {({ draft, patch }) => (
        <>
          <FormCard title="Paiement">
            <div className="space-y-4">
              <Toggle
                checked={draft.stripe_enabled}
                onChange={v => patch({ stripe_enabled: v })}
                label="Activer Stripe"
              />
              <Field label="Identifiant de compte Stripe" htmlFor="stripe_account_id">
                <TextInput
                  id="stripe_account_id"
                  value={draft.stripe_account_id}
                  onChange={e => patch({ stripe_account_id: e.target.value })}
                  placeholder="acct_..."
                  disabled={!draft.stripe_enabled}
                />
              </Field>
              <Toggle
                checked={draft.mobile_money_enabled}
                onChange={v => patch({ mobile_money_enabled: v })}
                label="Activer Mobile Money"
              />
              {draft.mobile_money_enabled && (
                <Field label="Provider Mobile Money" htmlFor="mobile_money_provider">
                  <SelectInput
                    id="mobile_money_provider"
                    value={draft.mobile_money_provider}
                    onChange={e => patch({ mobile_money_provider: e.target.value })}
                    placeholder=""
                    options={[
                      { value: 'wave',        label: 'Wave' },
                      { value: 'orange_money', label: 'Orange Money' },
                      { value: 'mtn_momo',    label: 'MTN MoMo' },
                    ]}
                  />
                </Field>
              )}
            </div>
          </FormCard>

          <FormCard title="Livraison">
            <div className="space-y-3">
              <Toggle checked={draft.uber_direct_enabled} onChange={v => patch({ uber_direct_enabled: v })} label="Uber Direct" />
              <Toggle checked={draft.glovo_enabled}        onChange={v => patch({ glovo_enabled: v })}        label="Glovo" />
              <Toggle checked={draft.yango_enabled}        onChange={v => patch({ yango_enabled: v })}        label="Yango" />
            </div>
          </FormCard>

          <FormCard title="POS">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Provider POS" htmlFor="pos_provider">
                <TextInput
                  id="pos_provider"
                  value={draft.pos_provider}
                  onChange={e => patch({ pos_provider: e.target.value })}
                  placeholder="lightspeed, zelty…"
                />
              </Field>
              <Field label="Identifiant externe POS" htmlFor="pos_external_id">
                <TextInput
                  id="pos_external_id"
                  value={draft.pos_external_id}
                  onChange={e => patch({ pos_external_id: e.target.value })}
                />
              </Field>
            </div>
          </FormCard>
        </>
      )}
    </PreviewTab>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet API & Webhooks
// ─────────────────────────────────────────────────────────────────────────────
function ApiWebhooksTab() {
  return (
    <PreviewTab
      section="api_webhooks"
      defaults={API_WEBHOOKS_DEFAULTS}
      version="v2"
      title="API & Webhooks"
      description="Webhooks sortants déclenchés par les événements métier du tenant."
    >
      {({ draft, patch }) => (
        <>
          <FormCard title="Endpoint">
            <div className="space-y-4 max-w-xl">
              <Field label="URL de réception" htmlFor="webhook_url">
                <TextInput
                  id="webhook_url"
                  value={draft.webhook_url}
                  onChange={e => patch({ webhook_url: e.target.value })}
                  placeholder="https://votre-systeme.com/webhooks/restoaify"
                />
              </Field>
              <Field label="Secret de signature" htmlFor="webhook_secret" hint="Utilisé pour vérifier la signature HMAC-SHA256.">
                <input
                  id="webhook_secret"
                  type="password"
                  className="input"
                  value={draft.webhook_secret}
                  onChange={e => patch({ webhook_secret: e.target.value })}
                />
              </Field>
              <Toggle
                checked={draft.retry_on_failure}
                onChange={v => patch({ retry_on_failure: v })}
                label="Réessayer en cas d'échec"
              />
            </div>
          </FormCard>

          <FormCard title="Événements abonnés">
            <div className="space-y-2">
              {Object.entries(draft.events).map(([key, enabled]) => (
                <Toggle
                  key={key}
                  checked={enabled}
                  onChange={v => patch({ events: { ...draft.events, [key]: v } })}
                  label={key.replace(/_/g, ' ')}
                />
              ))}
            </div>
          </FormCard>
        </>
      )}
    </PreviewTab>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet Notifications
// ─────────────────────────────────────────────────────────────────────────────
function NotificationsTab() {
  return (
    <PreviewTab
      section="notifications"
      defaults={NOTIFICATIONS_DEFAULTS}
      version="v1.5"
      title="Notifications internes"
      description="Alertes internes pour les membres de votre équipe."
    >
      {({ draft, patch }) => (
        <FormCard title="Préférences">
          <div className="space-y-4">
            <Field label="Canal préféré" htmlFor="channel_preference">
              <SelectInput
                id="channel_preference"
                value={draft.channel_preference}
                onChange={e => patch({ channel_preference: e.target.value })}
                placeholder=""
                options={[
                  { value: 'email', label: 'Email' },
                  { value: 'slack', label: 'Slack' },
                  { value: 'both',  label: 'Email + Slack' },
                ]}
              />
            </Field>
            <Field label="Fréquence" htmlFor="digest_frequency">
              <SelectInput
                id="digest_frequency"
                value={draft.digest_frequency}
                onChange={e => patch({ digest_frequency: e.target.value })}
                placeholder=""
                options={[
                  { value: 'realtime', label: 'Temps réel' },
                  { value: 'hourly',   label: 'Toutes les heures' },
                  { value: 'daily',    label: 'Quotidien' },
                ]}
              />
            </Field>
            <Toggle
              checked={draft.notify_workflow_failure}
              onChange={v => patch({ notify_workflow_failure: v })}
              label="Notifier les erreurs de workflow"
            />
            <Toggle
              checked={draft.notify_channel_error}
              onChange={v => patch({ notify_channel_error: v })}
              label="Notifier les erreurs de canal"
            />
            <Toggle
              checked={draft.notify_new_handoff}
              onChange={v => patch({ notify_new_handoff: v })}
              label="Notifier les nouveaux handoffs"
            />
            <Toggle
              checked={draft.notify_high_value_order}
              onChange={v => patch({ notify_high_value_order: v })}
              label="Notifier les commandes à forte valeur"
            />
          </div>
        </FormCard>
      )}
    </PreviewTab>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet Sécurité
// ─────────────────────────────────────────────────────────────────────────────
function SecurityTab() {
  return (
    <PreviewTab
      section="security"
      defaults={SECURITY_DEFAULTS}
      version="v1.5"
      title="Sécurité"
      description="Politique d'accès et d'authentification du tenant."
    >
      {({ draft, patch }) => (
        <>
          <FormCard title="Authentification">
            <div className="space-y-4">
              <Toggle
                checked={draft.require_mfa}
                onChange={v => patch({ require_mfa: v })}
                label="Exiger la double authentification (MFA)"
              />
              <Field label="Durée d'une session (heures)" htmlFor="session_duration_hours">
                <input
                  id="session_duration_hours"
                  type="number" min="1" max="168" className="input max-w-xs"
                  value={draft.session_duration_hours}
                  onChange={e => patch({ session_duration_hours: Number(e.target.value || 1) })}
                />
              </Field>
              <Field label="Rotation du mot de passe (jours, 0 = désactivé)" htmlFor="password_rotation_days">
                <input
                  id="password_rotation_days"
                  type="number" min="0" className="input max-w-xs"
                  value={draft.password_rotation_days}
                  onChange={e => patch({ password_rotation_days: Number(e.target.value) })}
                />
              </Field>
            </div>
          </FormCard>

          <FormCard title="Accès réseau">
            <Field label="IP autorisées (allowlist)" htmlFor="ip_allow_list" hint="Une IP ou CIDR par ligne. Vide = toutes les IP autorisées.">
              <Textarea
                id="ip_allow_list"
                rows={4}
                value={draft.ip_allow_list}
                onChange={e => patch({ ip_allow_list: e.target.value })}
                placeholder={'192.168.1.0/24\n10.0.0.1'}
              />
            </Field>
          </FormCard>

          <FormCard title="SSO">
            <div className="space-y-4">
              <Toggle
                checked={draft.enforce_sso}
                onChange={v => patch({ enforce_sso: v })}
                label="Forcer l'authentification SSO"
              />
              {draft.enforce_sso && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Provider SSO" htmlFor="sso_provider">
                    <SelectInput
                      id="sso_provider"
                      value={draft.sso_provider}
                      onChange={e => patch({ sso_provider: e.target.value })}
                      placeholder="Choisir…"
                      options={[
                        { value: 'google',   label: 'Google Workspace' },
                        { value: 'microsoft', label: 'Microsoft Entra' },
                        { value: 'okta',     label: 'Okta' },
                        { value: 'saml',     label: 'SAML générique' },
                      ]}
                    />
                  </Field>
                  <Field label="Domaine SSO" htmlFor="sso_domain">
                    <TextInput
                      id="sso_domain"
                      value={draft.sso_domain}
                      onChange={e => patch({ sso_domain: e.target.value })}
                      placeholder="monentreprise.com"
                    />
                  </Field>
                </div>
              )}
            </div>
          </FormCard>
        </>
      )}
    </PreviewTab>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet Données & RGPD
// ─────────────────────────────────────────────────────────────────────────────
function DataPrivacyTab() {
  return (
    <PreviewTab
      section="data_privacy"
      defaults={DATA_PRIVACY_DEFAULTS}
      version="v2"
      title="Données & RGPD"
      description="Rétention, export et anonymisation des données personnelles."
    >
      {({ draft, patch }) => (
        <>
          <FormCard title="Rétention des données">
            <div className="space-y-4">
              <Field label="Durée de rétention (jours)" htmlFor="data_retention_days" hint="Minimum recommandé : 90 jours.">
                <input
                  id="data_retention_days"
                  type="number" min="30" className="input max-w-xs"
                  value={draft.data_retention_days}
                  onChange={e => patch({ data_retention_days: Number(e.target.value || 30) })}
                />
              </Field>
              <Toggle
                checked={draft.auto_anonymize_contacts}
                onChange={v => patch({ auto_anonymize_contacts: v })}
                label="Anonymiser automatiquement les contacts inactifs à l'expiration"
              />
            </div>
          </FormCard>

          <FormCard title="Droits des personnes concernées">
            <div className="space-y-4">
              <Toggle
                checked={draft.allow_export_requests}
                onChange={v => patch({ allow_export_requests: v })}
                label="Autoriser les demandes d'export (droit à la portabilité)"
              />
              <Field label="Email de contact RGPD" htmlFor="legal_contact_email">
                <TextInput
                  id="legal_contact_email"
                  value={draft.legal_contact_email}
                  onChange={e => patch({ legal_contact_email: e.target.value })}
                  placeholder="privacy@votre-domaine.com"
                />
              </Field>
              <Field label="Message de consentement" htmlFor="consent_message">
                <Textarea
                  id="consent_message"
                  rows={3}
                  value={draft.consent_message}
                  onChange={e => patch({ consent_message: e.target.value })}
                  placeholder="En utilisant ce service, vous acceptez…"
                />
              </Field>
            </div>
          </FormCard>
        </>
      )}
    </PreviewTab>
  )
}
