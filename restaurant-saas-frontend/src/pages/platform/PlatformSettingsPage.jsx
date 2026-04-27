import PageHeader from '../../components/PageHeader.jsx'

export default function PlatformSettingsPage() {
  return (
    <div>
      <PageHeader title="Paramètres plateforme" subtitle="Configuration globale (à venir)" />
      <div className="card p-6">
        <p className="text-sm text-gray-600">
          Cette page accueillera la configuration globale de la plateforme : plans
          SaaS, paramètres système, observabilité, etc. À implémenter quand les
          besoins se précisent côté ops.
        </p>
      </div>
    </div>
  )
}
