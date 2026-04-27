import PageHeader from '../components/PageHeader.jsx'
import ComingSoonCard from '../components/ComingSoonCard.jsx'
import { getModule } from '../config/modules.js'

export default function ComingSoonPage({ moduleKey }) {
  const m = moduleKey ? getModule(moduleKey) : null
  const title = m?.name || 'Module à venir'
  const description = m?.description

  return (
    <div>
      <PageHeader title={title} subtitle="Module réservé — non implémenté en v1" />
      <ComingSoonCard title={title} description={description} />
    </div>
  )
}
