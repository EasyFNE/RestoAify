// src/pages/tenant/SettingsPage.jsx
import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader.jsx';
import Button from '../../components/Button.jsx';
import FormField from '../../components/FormField.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { cn } from '../../lib/cn.js';
import { useTenant } from '../../hooks/useTenant.js';
import { useAuth } from '../../hooks/useAuth.js';
import { api } from '../../services/api.js';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration des onglets
// moduleCode  → lié à tenant_entitlements (null = pas de gating plan)
// status      → 'active' | 'v1_5' | 'v2'  (roadmap)
// ─────────────────────────────────────────────────────────────────────────────

const SETTINGS_TABS = [
  // Groupe 1 — Organisation
  { group: 'Organisation', key: 'general',           label: 'Général',                   status: 'active', moduleCode: null },
  { group: 'Organisation', key: 'branding',          label: 'Marque & identité',         status: 'v1_5',   moduleCode: null },
  { group: 'Organisation', key: 'localization',      label: 'Localisation',              status: 'v1_5',   moduleCode: null },

  // Groupe 2 — Métier
  { group: 'Métier',       key: 'business_rules',    label: 'Règles métier par défaut',  status: 'v1_5',   moduleCode: null },
  { group: 'Métier',       key: 'message_templates', label: 'Modèles de messages',       status: 'v1_5',   moduleCode: null },
  { group: 'Métier',       key: 'agent',             label: 'Agent IA & conversations',  status: 'v1_5',   moduleCode: 'handoff' },

  // Groupe 3 — Connectivité
  { group: 'Connectivité', key: 'channels',          label: 'Canaux de communication',   status: 'v1_5',   moduleCode: null },
  { group: 'Connectivité', key: 'integrations',      label: 'Intégrations externes',     status: 'v1_5',   moduleCode: null },
  { group: 'Connectivité', key: 'api_webhooks',      label: 'API & Webhooks',            status: 'v2',     moduleCode: null },

  // Groupe 4 — Gouvernance
  { group: 'Gouvernance',  key: 'notifications',     label: 'Notifications internes',    status: 'v1_5',   moduleCode: null },
  { group: 'Gouvernance',  key: 'security',          label: 'Sécurité',                  status: 'v1_5',   moduleCode: null },
  { group: 'Gouvernance',  key: 'data_privacy',      label: 'Données & RGPD',            status: 'v2',     moduleCode: null },
];

// Meta descriptions + champs pour chaque onglet non actif (roadmap)
const ROADMAP_TAB_META = {
  branding: {
    description: "Personnalisez l'identité visuelle de votre tenant : logo, couleurs et nom d'affichage présentés à vos clients.",
    fields: ['Logo & favicon', 'Couleur principale', "Nom d'affichage public", 'Bannière de bienvenue'],
  },
  localization: {
    description: 'Configurez la langue par défaut, le fuseau horaire et la devise utilisés dans toutes les interfaces et communications.',
    fields: ['Langue par défaut', 'Fuseau horaire', 'Devise & format monétaire', 'Format de date'],
  },
  business_rules: {
    description: "Définissez les règles métier par défaut applicables à tous vos restaurants : délais de confirmation, capacités, politiques d'annulation.",
    fields: ['Délai de confirmation commande', "Politique d'annulation", "Capacité d'accueil par défaut", 'Délai minimum réservation', "Horaires d'ouverture génériques"],
  },
  message_templates: {
    description: 'Gérez les modèles de messages envoyés automatiquement à vos clients lors des étapes clés (confirmation, rappel, annulation).',
    fields: ['Modèle de confirmation commande', 'Modèle de rappel réservation', "Modèle d'annulation", 'Modèle de bienvenue', 'Variables dynamiques disponibles'],
  },
  agent: {
    description: "Configurez le comportement de l'agent IA : ton, limites de décision autonome et escalades vers un humain.",
    fields: ["Nom de l'agent", 'Ton et style de réponse', "Seuil d'escalade automatique", "Modules activés pour l'agent", 'Langue de conversation par défaut'],
  },
  channels: {
    description: 'Connectez et configurez vos canaux de communication (WhatsApp, e-mail, SMS, webchat) au niveau du tenant.',
    fields: ['WhatsApp Business API', 'E-mail sortant (SMTP / provider)', 'SMS', 'Webchat', 'Statut & santé des canaux'],
  },
  integrations: {
    description: "Intégrez des services tiers (CRM, ERP, caisse, logistique) pour synchroniser vos données avec l'écosystème existant.",
    fields: ['Logiciel de caisse', 'CRM externe', 'Plateforme logistique', 'Outils de reporting', 'Gestion des credentials'],
  },
  api_webhooks: {
    description: "Accédez à l'API REST du tenant et configurez les webhooks pour pousser des événements vers vos systèmes externes.",
    fields: ['Clés API (génération & révocation)', 'Endpoints webhook', 'Événements déclencheurs', "Logs d'appels entrants/sortants"],
  },
  notifications: {
    description: "Paramétrez les alertes internes envoyées à votre équipe : nouvelles commandes, escalades, erreurs critiques.",
    fields: ["Destinataires par type d'événement", 'Canal de notification (e-mail, Slack…)', "Seuils d'alerte", 'Fréquence de digest'],
  },
  security: {
    description: "Gérez les politiques de sécurité du tenant : durée de session, MFA, liste d'IP autorisées et révocation de comptes.",
    fields: ['Durée de session', 'Obligation MFA', "Liste blanche d'IP", 'Verrouillage après N tentatives', 'Politique de mot de passe'],
  },
  data_privacy: {
    description: 'Configurez les règles de rétention des données et les exports RGPD pour répondre aux obligations légales.',
    fields: ['Durée de rétention par type de donnée', 'Export RGPD (format JSON/CSV)', "Droit à l'oubli — procédure", 'Responsable de traitement'],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const GROUPS = [...new Set(SETTINGS_TABS.map((t) => t.group))];

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(dateStr)
  );
}

/** Badge version roadmap (v1.5 / v2) */
function BadgeVersion({ status }) {
  const label = status === 'v2' ? 'v2' : 'v1.5';
  const cls =
    status === 'v2'
      ? 'bg-purple-100 text-purple-700 border border-purple-200'
      : 'bg-amber-100 text-amber-700 border border-amber-200';
  return (
    <span className={cn('ml-1.5 inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium', cls)}>
      {label}
    </span>
  );
}

/** Badge module non souscrit (plan) */
function BadgeLocked() {
  return (
    <span className="ml-1.5 inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-6V7a4 4 0 00-8 0v4" />
        <rect x="3" y="11" width="18" height="11" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Plan
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Placeholder — module hors plan (upgrade requis)
// ─────────────────────────────────────────────────────────────────────────────

function LockedModulePlaceholder({ tab }) {
  const meta = ROADMAP_TAB_META[tab.key] ?? {
    description: 'Ce module nécessite une souscription active.',
    fields: [],
  };
  return (
    <div className="flex flex-col items-center text-center py-10 px-4">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
        <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      </div>
      <h2 className="text-base font-semibold text-gray-800">{tab.label}</h2>
      <p className="mt-2 text-sm text-gray-500 max-w-sm">
        Ce module n'est pas inclus dans votre plan actuel.
      </p>
      <p className="mt-1 text-sm text-gray-400 max-w-sm">{meta.description}</p>
      {meta.fields.length > 0 && (
        <ul className="mt-4 space-y-1 text-left">
          {meta.fields.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-gray-400">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
              {f}
            </li>
          ))}
        </ul>
      )}
      <Button variant="primary" size="sm" className="mt-6" type="button">
        Mettre à niveau le plan
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Placeholder — onglet en développement (roadmap v1.5 / v2)
// ─────────────────────────────────────────────────────────────────────────────

function RoadmapTabPlaceholder({ tab }) {
  const meta = ROADMAP_TAB_META[tab.key] ?? {
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
          {meta.fields.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-gray-400">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
              {f}
            </li>
          ))}
        </ul>
      )}
    </div>
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
    try { await navigator.clipboard.writeText(currentTenant?.id ?? ''); } catch { /* silencieux */ }
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
        <FormField label="Nom" htmlFor="settings-name" required>
          {canEdit ? (
            <input id="settings-name" name="name" type="text" className="input w-full"
              value={form.name} onChange={handleChange} required />
          ) : (
            <p className="input w-full bg-gray-50 text-gray-700 select-all">{form.name}</p>
          )}
        </FormField>

        <FormField label="Slug" htmlFor="settings-slug" hint="Modifiable uniquement à la création">
          <input id="settings-slug" name="slug" type="text"
            className="input w-full bg-gray-50 text-gray-500 cursor-not-allowed"
            value={currentTenant?.slug ?? ''} readOnly title="Modifiable uniquement à la création" />
        </FormField>

        <FormField label="Plan" htmlFor="settings-plan">
          <input id="settings-plan" type="text"
            className="input w-full bg-gray-50 text-gray-500 cursor-not-allowed"
            value={currentPlanName} readOnly />
        </FormField>

        <FormField label="Statut">
          <div className="pt-1"><StatusBadge status={currentTenant?.status} /></div>
        </FormField>

        <FormField label="Identifiant (ID)" htmlFor="settings-id">
          <div className="flex items-center gap-2">
            <code className="input flex-1 bg-gray-50 text-gray-500 font-mono text-sm cursor-default select-all">
              {currentTenant?.id ?? '—'}
            </code>
            <Button type="button" variant="secondary" size="sm" onClick={handleCopyId} title="Copier l'identifiant">
              Copier
            </Button>
          </div>
        </FormField>

        <FormField label="Créé le">
          <p className="input w-full bg-gray-50 text-gray-500 cursor-default">{formatDate(currentTenant?.created_at)}</p>
        </FormField>

        <FormField label="Mis à jour le">
          <p className="input w-full bg-gray-50 text-gray-500 cursor-default">{formatDate(currentTenant?.updated_at)}</p>
        </FormField>
      </div>

      {canEdit && (
        <div className="mt-8 flex justify-end">
          <Button type="submit" variant="primary" disabled={!dirty || submitting}>
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      )}
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page principale
// ─────────────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { currentTenant, currentTenantId, isModuleEnabled } = useTenant();
  const { currentUser } = useAuth();
  const role = currentUser?.role ?? null;

  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const defaultTab = SETTINGS_TABS.find((t) => t.key === tabFromUrl) ? tabFromUrl : 'general';
  const [activeKey, setActiveKey] = useState(defaultTab);

  const activeTab = SETTINGS_TABS.find((t) => t.key === activeKey) ?? SETTINGS_TABS[0];
  const canEdit = role === 'tenant_owner' || role === 'tenant_admin';

  /**
   * Détermine si un onglet est cliquable (navigable).
   * Un onglet roadmap (v1_5 / v2) reste cliquable pour afficher le placeholder.
   * Un onglet dont le module n'est pas souscrit affiche le placeholder "plan".
   */
  const isTabClickable = useCallback(
    (tab) => {
      // roadmap : on peut cliquer pour voir le placeholder
      if (tab.status !== 'active') return true;
      // pas de gating module
      if (!tab.moduleCode) return true;
      // gating par entitlement
      return isModuleEnabled ? isModuleEnabled(tab.moduleCode) : true;
    },
    [isModuleEnabled]
  );

  /**
   * L'onglet est-il verrouillé par le plan (module non souscrit) ?
   * Uniquement pour les onglets actifs (v1) liés à un moduleCode.
   */
  const isTabLockedByPlan = useCallback(
    (tab) => {
      if (tab.status !== 'active') return false;
      if (!tab.moduleCode) return false;
      return isModuleEnabled ? !isModuleEnabled(tab.moduleCode) : false;
    },
    [isModuleEnabled]
  );

  const handleSelectTab = useCallback(
    (tab) => {
      setActiveKey(tab.key);
      setSearchParams({ tab: tab.key }, { replace: true });
    },
    [setSearchParams]
  );

  const sidebarByGroup = GROUPS.map((group) => ({
    group,
    tabs: SETTINGS_TABS.filter((t) => t.group === group),
  }));

  // Rendu du contenu de l'onglet actif
  function renderContent() {
    if (isTabLockedByPlan(activeTab)) {
      return <LockedModulePlaceholder tab={activeTab} />;
    }
    if (activeTab.status !== 'active') {
      return <RoadmapTabPlaceholder tab={activeTab} />;
    }
    // onglets actifs
    switch (activeTab.key) {
      case 'general':
        return (
          <GeneralTab
            currentTenant={currentTenant}
            currentTenantId={currentTenantId}
            canEdit={canEdit}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Paramètres" subtitle="Configuration de votre tenant" />

      <div className="flex flex-col md:flex-row gap-6 items-start">

        {/* ── Sidebar verticale ── */}
        <nav
          className={cn(
            'w-full md:w-56 md:flex-shrink-0',
            'bg-white border border-gray-200 rounded-lg',
            'md:sticky md:top-4 self-start'
          )}
          aria-label="Navigation des paramètres"
        >
          {sidebarByGroup.map(({ group, tabs }, gi) => (
            <div
              key={group}
              className={cn('py-1', gi > 0 && 'border-t border-gray-100')}
            >
              <p className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider select-none">
                {group}
              </p>
              <ul>
                {tabs.map((tab) => {
                  const isActive   = tab.key === activeKey;
                  const lockedPlan = isTabLockedByPlan(tab);
                  const isRoadmap  = tab.status !== 'active';

                  return (
                    <li key={tab.key}>
                      <button
                        type="button"
                        onClick={() => handleSelectTab(tab)}
                        className={cn(
                          'flex items-center justify-between w-full text-left px-3 py-2 text-sm transition-colors rounded-sm',
                          isActive
                            ? 'border-l-2 border-brand-600 text-brand-700 bg-brand-50 font-medium'
                            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900',
                          lockedPlan && !isActive && 'text-gray-400',
                          isRoadmap  && !isActive && 'text-gray-400'
                        )}
                        aria-current={isActive ? 'page' : undefined}
                        title={
                          lockedPlan
                            ? 'Module non inclus dans votre plan'
                            : isRoadmap
                            ? `Disponible en ${tab.status === 'v2' ? 'v2' : 'v1.5'}`
                            : undefined
                        }
                      >
                        <span className="truncate">{tab.label}</span>
                        <span className="flex-shrink-0">
                          {lockedPlan  && <BadgeLocked />}
                          {!lockedPlan && isRoadmap && <BadgeVersion status={tab.status} />}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* ── Contenu ── */}
        <div className="flex-1 min-w-0">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
