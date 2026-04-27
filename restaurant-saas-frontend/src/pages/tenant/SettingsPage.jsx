import { useState } from 'react'
import PageHeader from '../../components/PageHeader.jsx'
import { cn } from '../../lib/cn.js'

const TABS = [
  { key: 'general',    label: 'Général' },
  { key: 'branding',   label: 'Marque' },
  { key: 'business',   label: 'Règles métier' },
  { key: 'notifications', label: 'Notifications' },
]

export default function SettingsPage() {
  const [tab, setTab] = useState('general')

  return (
    <div>
      <PageHeader title="Paramètres" subtitle="Configuration de votre tenant" />

      <div className="card overflow-hidden">
        <div className="flex border-b border-gray-200">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'px-4 py-2.5 text-sm border-b-2 -mb-px',
                tab === t.key
                  ? 'border-brand-600 text-brand-700 font-medium'
                  : 'border-transparent text-gray-600 hover:text-gray-900',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="p-6 text-sm text-gray-600">
          {tab === 'general' && (
            <p>Paramètres généraux du tenant (nom, contact, langue par défaut, etc.). Implémentation à venir.</p>
          )}
          {tab === 'branding' && (
            <p>Logo, couleurs, identité visuelle. Implémentation à venir.</p>
          )}
          {tab === 'business' && (
            <p>Règles métier transverses (heures d'ouverture par défaut, devises, taxes, etc.) — voir <code>05-business-rules.md</code>.</p>
          )}
          {tab === 'notifications' && (
            <p>Préférences de notifications (canaux, escalades, alertes ops). Implémentation à venir.</p>
          )}
        </div>
      </div>
    </div>
  )
}
