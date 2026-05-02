// src/pages/tenant/SettingsPage.jsx
import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader.jsx';
import Button from '../../components/Button.jsx';
import FormField from '../../components/FormField.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { cn } from '../../lib/cn.js';
import { useTenant } from '../../hooks/useTenant.js';
import { useAuthContext } from '../../hooks/useAuthContext.js';
import * as api from '../../services/api.js';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration des onglets
// ─────────────────────────────────────────────────────────────────────────────

const SETTINGS_TABS = [
  // Groupe 1 — Organisation
  { group: 'Organisation', key: 'general',           label: 'Général',                   status: 'active' },
  { group: 'Organisation', key: 'branding',          label: 'Marque & identité',         status: 'v1_5' },
  { group: 'Organisation', key: 'localization',      label: 'Localisation',              status: 'v1_5' },

  // Groupe 2 — Métier
  { group: 'Métier',       key: 'business_rules',    label: 'Règles métier par défaut',  status: 'v1_5' },
  { group: 'Métier',       key: 'message_templates', label: 'Modèles de messages',       status: 'v1_5' },
  { group: 'Métier',       key: 'agent',             label: 'Agent IA & conversations',  status: 'v1_5' },

  // Groupe 3 — Connectivité
  { group: 'Connectivité', key: 'channels',          label: 'Canaux de communication',   status: 'v1_5' },
  { group: 'Connectivité', key: 'integrations',      label: 'Intégrations externes',     status: 'v1_5' },
  { group: 'Connectivité', key: 'api_webhooks',      label: 'API & Webhooks',            status: 'v2' },

  // Groupe 4 — Gouvernance
  { group: 'Gouvernance',  key: 'notifications',     label: 'Notifications internes',    status: 'v1_5' },
  { group: 'Gouvernance',  key: 'security',          label: 'Sécurité',                  status: 'v1_5' },
  { group: 'Gouvernance',  key: 'data_privacy',      label: 'Données & RGPD',            status: 'v2' },
];

// Descriptions et champs à venir pour chaque onglet disabled
const DISABLED_TAB_META = {
  branding: {
    description:
      "Personnalisez l'identité visuelle de votre tenant : logo, couleurs et nom d'affichage présentés à vos clients.",
    fields: ['Logo & favicon', 'Couleur principale', "Nom d'affichage public", 'Bannière de bienvenue'],
  },
  localization: {
    description:
      'Configurez la langue par défaut, le fuseau horaire et la devise utilisés dans toutes les interfaces et communications.',
    fields: ['Langue par défaut', 'Fuseau horaire', 'Devise & format monétaire', 'Format de date'],
  },
  business_rules: {
    description:
      "Définissez les règles métier par défaut applicables à tous vos restaurants : délais de confirmation, capacités, politiques d'annulation.",
    fields: [
      'Délai de confirmation commande',
      "Politique d'annulation",
      "Capacité d'accueil par défaut",
      'Délai minimum réservation',
      "Horaires d'ouverture génériques",
    ],
  },
  message_templates: {
    description:
      'Gérez les modèles de messages envoyés automatiquement à vos clients lors des étapes clés (confirmation, rappel, annulation).',
    fields: [
      'Modèle de confirmation commande',
      'Modèle de rappel réservation',
      "Modèle d'annulation",
      'Modèle de bienvenue',
      'Variables dynamiques disponibles',
    ],
  },
  agent: {
    description:
      "Configurez le comportement de l'agent IA : ton, limites de décision autonome et escalades vers un humain.",
    fields: [
      "Nom de l'agent",
      'Ton et style de réponse',
      "Seuil d'escalade automatique",
      "Modules activés pour l'agent",
      'Langue de conversation par défaut',
    ],
  },
  channels: {
    description:
      'Connectez et configurez vos canaux de communication (WhatsApp, e-mail, SMS, webchat) au niveau du tenant.',
    fields: [
      'WhatsApp Business API',
      'E-mail sortant (SMTP / provider)',
      'SMS',
      'Webchat',
      'Statut & santé des canaux',
    ],
  },
  integrations: {
    description:
      "Intégrez des services tiers (CRM, ERP, caisse, logistique) pour synchroniser vos données avec l'écosystème existant.",
    fields: [
      'Logiciel de caisse',
      'CRM externe',
      'Plateforme logistique',
      'Outils de reporting',
      'Gestion des credentials',
    ],
  },
  api_webhooks: {
    description:
      "Accédez à l'API REST du tenant et configurez les webhooks pour pousser des événements vers vos systèmes externes.",
    fields: [
      'Clés API (génération & révocation)',
      'Endpoints webhook',
      'Événements déclencheurs',
      "Logs d'appels entrants/sortants",
    ],
  },
  notifications: {
    description:
      "Paramétrez les alertes internes envoyées à votre équipe : nouvelles commandes, escalades, erreurs critiques.",
    fields: [
      "Destinataires par type d'événement",
      'Canal de notification (e-mail, Slack…)',
      "Seuils d'alerte",
      'Fréquence de digest',
    ],
  },
  security: {
    description:
      "Gérez les politiques de sécurité du tenant : durée de session, MFA, liste d'IP autorisées et révocation de comptes.",
    fields: [
      'Durée de session',
      'Obligation MFA',
      "Liste blanche d'IP",
      'Verrouillage après N tentatives',
      'Politique de mot de passe',
    ],
  },
  data_privacy: {
    description:
      'Configurez les règles de rétention des données et les exports RGPD pour répondre aux obligations légales.',
    fields: [
      'Durée de rétention par type de donnée',
      'Export RGPD (format JSON/CSV)',
      "Droit à l'oubli — procédure",
      'Responsable de traitement',
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const GROUPS = [...new Set(SETTINGS_TABS.map((t) => t.group))];

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(dateStr));
}

function BadgeVersion({ status }) {
  const label = status === 'v2' ? 'v2' : 'v1.5';
  const cls =
    status === 'v2'
      ? 'bg-purple-100 text-purple-700 border border-purple-200'
      : 'bg-amber-100 text-amber-700 border border-amber-200';
  return (
    <span className={cn('ml-2 inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium', cls)}>
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet Général
// ─────────────────────────────────────────────────────────────────────────────

function GeneralTab({ currentTenant, currentTenantId, canEdit }) {
  const [plans, setPlans] = useState([]);
  const [form, setForm] = useState({ name: currentTenant?.name ?? '' });
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    api.listPlans().then((data) => setPlans(data ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    setForm({ name: currentTenant?.name ?? '' });
    setDirty(false);
  }, [currentTenant?.id]);

  const currentPlanName =
    plans.find((p) => p.id === currentTenant?.plan_id)?.name ?? currentTenant?.plan_id ?? '—';

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setDirty(true);
    setSuccessMsg('');
    setErrorMsg('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!dirty || !currentTenantId) return;
    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.updateTenant(currentTenantId, { name: form.name });
      setDirty(false);
      setSuccessMsg('Paramètres enregistrés.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg(err?.message ?? 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopyId() {
    try {
      await navigator.clipboard.writeText(currentTenant?.id ?? '');
    } catch {
      // silencieux
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {successMsg && (
        <div className="mb-4 rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      <div className="space-y-5">
        {/* Nom */}
        <FormField label="Nom" htmlFor="settings-name" required>
          {canEdit ? (
            <input
              id="settings-name"
              name="name"
              type="text"
              className="input w-full"
              value={form.name}
              onChange={handleChange}
              required
            />
          ) : (
            <p className="input w-full bg-gray-50 text-gray-700 select-all">{form.name}</p>
          )}
        </FormField>

        {/* Slug — read-only */}
        <FormField
          label="Slug"
          htmlFor="settings-slug"
          hint="Modifiable uniquement à la création"
        >
          <input
            id="settings-slug"
            name="slug"
            type="text"
            className="input w-full bg-gray-50 text-gray-500 cursor-not-allowed"
            value={currentTenant?.slug ?? ''}
            readOnly
            title="Modifiable uniquement à la création"
          />
        </FormField>

        {/* Plan — read-only */}
        <FormField label="Plan" htmlFor="settings-plan">
          <input
            id="settings-plan"
            type="text"
            className="input w-full bg-gray-50 text-gray-500 cursor-not-allowed"
            value={currentPlanName}
            readOnly
          />
        </FormField>

        {/* Statut */}
        <FormField label="Statut">
          <div className="pt-1">
            <StatusBadge status={currentTenant?.status} />
          </div>
        </FormField>

        {/* ID avec copier */}
        <FormField label="Identifiant (ID)" htmlFor="settings-id">
          <div className="flex items-center gap-2">
            <code className="input flex-1 bg-gray-50 text-gray-500 font-mono text-sm cursor-default select-all">
              {currentTenant?.id ?? '—'}
            </code>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCopyId}
              title="Copier l'identifiant"
            >
              Copier
            </Button>
          </div>
        </FormField>

        {/* Créé le */}
        <FormField label="Créé le">
          <p className="input w-full bg-gray-50 text-gray-500 cursor-default">
            {formatDate(currentTenant?.created_at)}
          </p>
        </FormField>

        {/* Mis à jour le */}
        <FormField label="Mis à jour le">
          <p className="input w-full bg-gray-50 text-gray-500 cursor-default">
            {formatDate(currentTenant?.updated_at)}
          </p>
        </FormField>
      </div>

      {canEdit && (
        <div className="mt-8 flex justify-end">
          <Button
            type="submit"
            variant="primary"
            disabled={!dirty || submitting}
          >
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      )}
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Placeholder onglet disabled
// ─────────────────────────────────────────────────────────────────────────────

function DisabledTabPlaceholder({ tab }) {
  const meta = DISABLED_TAB_META[tab.key] ?? {
    description: 'Cette section sera disponible dans une prochaine version.',
    fields: [],
  };
  const versionLabel = tab.status === 'v2' ? 'Bientôt — v2' : 'Bientôt — v1.5';
  const versionCls =
    tab.status === 'v2'
      ? 'bg-purple-100 text-purple-700 border-purple-200'
      : 'bg-amber-100 text-amber-700 border-amber-200';

  return (
    <div className="relative">
      <span
        className={cn(
          'absolute top-0 right-0 inline-flex items-center rounded px-2 py-1 text-xs font-medium border',
          versionCls
        )}
      >
        {versionLabel}
      </span>

      <h2 className="text-lg font-semibold text-gray-800 pr-28">{tab.label}</h2>
      <p className="mt-2 text-sm text-gray-500 max-w-xl">{meta.description}</p>

      {meta.fields.length > 0 && (
        <ul className="mt-4 space-y-1">
          {meta.fields.map((field) => (
            <li key={field} className="flex items-center gap-2 text-sm text-gray-400">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
              {field}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page principale
// ─────────────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { currentTenant, currentTenantId } = useTenant();
  const { role } = useAuthContext();

  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const defaultTab = SETTINGS_TABS.find((t) => t.key === tabFromUrl && t.status === 'active')
    ? tabFromUrl
    : 'general';
  const [activeKey, setActiveKey] = useState(defaultTab);

  const activeTab = SETTINGS_TABS.find((t) => t.key === activeKey) ?? SETTINGS_TABS[0];

  const canEdit = role === 'tenant_owner' || role === 'tenant_admin';

  const handleSelectTab = useCallback(
    (tab) => {
      if (tab.status !== 'active') return;
      setActiveKey(tab.key);
      setSearchParams({ tab: tab.key }, { replace: true });
    },
    [setSearchParams]
  );

  const sidebarByGroup = GROUPS.map((group) => ({
    group,
    tabs: SETTINGS_TABS.filter((t) => t.group === group),
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Paramètres"
        subtitle="Configuration de votre tenant"
      />

      <div className="flex flex-col md:flex-row gap-6 items-start">

        {/* Sidebar */}
        <nav
          className={cn(
            'flex flex-row md:flex-col gap-0',
            'w-full md:w-[220px] md:flex-shrink-0',
            'overflow-x-auto md:overflow-visible',
            'bg-white border border-gray-200 rounded-lg',
            'md:sticky md:top-4'
          )}
          aria-label="Navigation des paramètres"
        >
          {sidebarByGroup.map(({ group, tabs }, gi) => (
            <div key={group} className={cn('md:block', gi > 0 && 'md:border-t md:border-gray-100')}>
              <p className="hidden md:block px-3 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {group}
              </p>
              <ul className="flex flex-row md:flex-col">
                {tabs.map((tab) => {
                  const isActive = tab.key === activeKey;
                  const isDisabled = tab.status !== 'active';

                  return (
                    <li key={tab.key}>
                      <button
                        type="button"
                        disabled={isDisabled}
                        onClick={() => handleSelectTab(tab)}
                        className={cn(
                          'flex items-center justify-between w-full text-left px-3 py-2 text-sm transition-colors',
                          'whitespace-nowrap md:whitespace-normal',
                          isActive &&
                            'border-l-2 border-brand-600 text-brand-700 bg-brand-50 font-medium',
                          !isActive && !isDisabled && 'text-gray-700 hover:bg-gray-50 hover:text-gray-900',
                          isDisabled && 'text-gray-400 cursor-not-allowed',
                          isDisabled && 'hover:bg-transparent'
                        )}
                        aria-current={isActive ? 'page' : undefined}
                        title={
                          isDisabled
                            ? `Disponible en ${tab.status === 'v2' ? 'v2' : 'v1.5'}`
                            : undefined
                        }
                      >
                        <span>{tab.label}</span>
                        {isDisabled && <BadgeVersion status={tab.status} />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Contenu */}
        <div className="flex-1 min-w-0">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            {activeTab.status === 'active' ? (
              <GeneralTab
                currentTenant={currentTenant}
                currentTenantId={currentTenantId}
                canEdit={canEdit}
              />
            ) : (
              <DisabledTabPlaceholder tab={activeTab} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
