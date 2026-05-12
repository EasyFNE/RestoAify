/**
 * WhatsAppPage.jsx
 *
 * Page Intégrations > WhatsApp.
 * Récupère session + tenantId depuis les contextes et délègue
 * tout le rendu à WhatsAppSettings.
 */

import { useAuth } from '../../hooks/useAuth.js'
import WhatsAppSettings from '../../components/WhatsAppSettings.jsx'

export default function WhatsAppPage() {
  const { session, currentUser } = useAuth()

  const token    = session?.access_token ?? null
  const tenantId = currentUser?.tenant_id ?? null

  if (!token || !tenantId) {
    return (
      <div className="p-8 text-sm text-gray-500">
        Session invalide — veuillez vous reconnecter.
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">WhatsApp Business</h1>
        <p className="mt-1 text-sm text-gray-500">
          Connectez votre compte WhatsApp Business via Meta Embedded Signup.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <WhatsAppSettings token={token} tenantId={tenantId} />
      </div>
    </div>
  )
}
