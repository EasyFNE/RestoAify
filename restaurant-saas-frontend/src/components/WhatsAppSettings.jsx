/**
 * WhatsAppSettings.jsx
 *
 * Onglet / section "WhatsApp" à intégrer dans SettingsPage.
 *
 * Fonctionnement :
 *  1. Au montage, appelle GET /whatsapp/channel pour afficher le statut actuel.
 *  2. Le bouton "Connecter via WhatsApp" charge le SDK Meta et ouvre
 *     l’Embedded Signup (FB.login).
 *  3. Après consentement, récupère code + waba_id + phone_number_id
 *     depuis sessionInfoListener, puis appelle POST /whatsapp/connect.
 *  4. Met à jour l’affichage avec les infos du channel créé/mis à jour.
 *
 * Usage dans SettingsPage :
 *   import WhatsAppSettings from '../../components/WhatsAppSettings'
 *   <WhatsAppSettings token={session.access_token} tenantId={tenantId} />
 */

import { useEffect, useRef, useState } from 'react'
import { backendApi } from '../services/backendApi.js'

// ── Constantes ────────────────────────────────────────────────────────────────
const META_APP_ID      = import.meta.env.VITE_META_APP_ID || ''
const META_CONFIG_ID   = import.meta.env.VITE_META_CONFIG_ID || ''
const META_SDK_VERSION = 'v21.0'

// ── Chargement SDK Meta (une seule fois) ──────────────────────────────────────
function loadFacebookSdk(appId, version) {
  return new Promise((resolve, reject) => {
    if (window.FB) { resolve(window.FB); return }

    window.fbAsyncInit = function () {
      window.FB.init({
        appId,
        autoLogAppEvents: true,
        xfbml: true,
        version,
      })
      resolve(window.FB)
    }

    const script = document.createElement('script')
    script.src = 'https://connect.facebook.net/en_US/sdk.js'
    script.async = true
    script.defer = true
    script.onerror = () => reject(new Error('Impossible de charger le SDK Meta'))
    document.body.appendChild(script)
  })
}

// ── Composant ─────────────────────────────────────────────────────────────────
/**
 * @param {{ token: string, tenantId: string }} props
 */
export default function WhatsAppSettings({ token, tenantId }) {
  const [channel, setChannel]   = useState(null)   // channel actif ou null
  const [loading, setLoading]   = useState(true)    // chargement initial
  const [connecting, setConnecting] = useState(false)
  const [error, setError]       = useState(null)
  const [success, setSuccess]   = useState(null)
  const sessionInfoRef          = useRef(null)      // données sessionInfoListener

  // ── 1. Charger le channel existant au montage ───────────────────────────────
  useEffect(() => {
    if (!token || !tenantId) { setLoading(false); return }

    backendApi.getWhatsAppChannel(token, tenantId)
      .then((res) => setChannel(res.data ?? null))
      .catch((err) => console.warn('[WhatsAppSettings] getWhatsAppChannel:', err))
      .finally(() => setLoading(false))
  }, [token, tenantId])

  // ── 2. Embedded Signup ─────────────────────────────────────────────────────
  async function handleConnect() {
    setError(null)
    setSuccess(null)
    setConnecting(true)
    sessionInfoRef.current = null

    try {
      // Charger le SDK Meta si pas encore présent
      const FB = await loadFacebookSdk(META_APP_ID, META_SDK_VERSION)

      // Enregistrer sessionInfoListener avant d’appeler FB.login
      // Ce listener reçoit waba_id + phone_number_id de Meta
      FB.event.subscribe('WhatsAppEmbeddedSignup.sessionInfo', (data) => {
        sessionInfoRef.current = data
      })

      // Ouvrir la popup Embedded Signup
      FB.login(
        async (response) => {
          if (response.status !== 'connected' || !response.authResponse?.code) {
            setError('Connexion annulée ou refusée par Meta.')
            setConnecting(false)
            return
          }

          const code = response.authResponse.code
          const sessionInfo = sessionInfoRef.current

          if (!sessionInfo?.waba_id || !sessionInfo?.phone_number_id) {
            setError(
              'Informations WABA manquantes. Veuillez réessayer en complétant toutes les étapes.'
            )
            setConnecting(false)
            return
          }

          // Appel backend : échange de code + upsert channel
          try {
            const res = await backendApi.connectWhatsApp(token, tenantId, {
              code,
              waba_id:        sessionInfo.waba_id,
              phone_number_id: sessionInfo.phone_number_id,
              restaurant_id:  null, // tenant-level en v1
            })

            if (res.success) {
              setChannel({
                channel_id:            res.data.channel_id,
                status:                res.data.status,
                phone_number_id:       res.data.phone_number_id,
                waba_id:               res.data.waba_id,
                verified_display_name: res.data.verified_display_name,
                verified_phone_number: res.data.verified_phone_number,
                connected_at:          new Date().toISOString(),
              })
              setSuccess('Numéro WhatsApp Business connecté avec succès !')
            } else {
              setError(res.error?.message || 'Erreur lors de la connexion.')
            }
          } catch (err) {
            setError(err.message || 'Erreur serveur lors de la connexion.')
          } finally {
            setConnecting(false)
          }
        },
        {
          config_id: META_CONFIG_ID,
          response_type: 'code',
          override_default_response_type: true,
          extras: { setup: {}, sessionInfoVersion: 3 },
        },
      )
    } catch (err) {
      setError(err.message || 'Impossible d’initialiser Meta SDK.')
      setConnecting(false)
    }
  }

  // ── Rendu ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 py-8">
        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        <span>Chargement du statut WhatsApp…</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        {/* Logo WhatsApp SVG inline */}
        <svg viewBox="0 0 32 32" className="h-8 w-8 flex-shrink-0" aria-label="WhatsApp">
          <circle cx="16" cy="16" r="16" fill="#25D366" />
          <path
            d="M16 7.5a8.5 8.5 0 00-7.41 12.68L7.5 24.5l4.46-1.06A8.5 8.5 0 1016 7.5zm0 15.5a7 7 0 01-3.56-.97l-.25-.15-2.65.63.66-2.58-.17-.27A7 7 0 1116 23zm3.84-5.2c-.21-.1-1.24-.61-1.43-.68-.19-.07-.33-.1-.47.1-.14.21-.54.68-.66.82-.12.14-.24.16-.45.05-.21-.1-.88-.32-1.68-1.03-.62-.55-1.04-1.23-1.16-1.44-.12-.21-.01-.32.09-.43.09-.1.21-.25.31-.38.1-.13.13-.21.2-.35.07-.14.03-.27-.02-.38-.05-.1-.47-1.14-.64-1.56-.17-.4-.34-.35-.47-.36-.12 0-.26-.01-.4-.01s-.37.05-.56.27c-.19.21-.74.72-.74 1.76s.76 2.04.87 2.18c.1.14 1.5 2.28 3.63 3.2.51.22.91.35 1.22.45.51.16.98.14 1.35.08.41-.06 1.24-.5 1.42-.99.17-.48.17-.9.12-.99-.06-.09-.2-.14-.41-.24z"
            fill="#fff"
          />
        </svg>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">WhatsApp Business</h3>
          <p className="text-sm text-gray-500">
            Connectez votre numéro WhatsApp Business via Meta Embedded Signup.
          </p>
        </div>
      </div>

      {/* Statut channel */}
      {channel ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500 inline-block" />
            <span className="text-sm font-medium text-green-800">Canal actif</span>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {channel.verified_display_name && (
              <>
                <dt className="text-gray-500">Nom affiché</dt>
                <dd className="font-medium text-gray-900">{channel.verified_display_name}</dd>
              </>
            )}
            {channel.verified_phone_number && (
              <>
                <dt className="text-gray-500">Numéro</dt>
                <dd className="font-medium text-gray-900">{channel.verified_phone_number}</dd>
              </>
            )}
            {channel.waba_id && (
              <>
                <dt className="text-gray-500">WABA ID</dt>
                <dd className="font-mono text-xs text-gray-700">{channel.waba_id}</dd>
              </>
            )}
            {channel.connected_at && (
              <>
                <dt className="text-gray-500">Connecté le</dt>
                <dd className="text-gray-700">
                  {new Date(channel.connected_at).toLocaleDateString('fr-FR', {
                    day: '2-digit', month: 'long', year: 'numeric',
                  })}
                </dd>
              </>
            )}
          </dl>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
          Aucun numéro WhatsApp Business connecté pour ce compte.
        </div>
      )}

      {/* Feedback */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Bouton Embedded Signup */}
      <button
        type="button"
        onClick={handleConnect}
        disabled={connecting}
        className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] hover:bg-[#1da851] disabled:opacity-60 disabled:cursor-not-allowed px-5 py-2.5 text-sm font-semibold text-white transition-colors"
      >
        {connecting ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Connexion en cours…
          </>
        ) : (
          <>
            <svg viewBox="0 0 32 32" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M16 7.5a8.5 8.5 0 00-7.41 12.68L7.5 24.5l4.46-1.06A8.5 8.5 0 1016 7.5z" />
            </svg>
            {channel ? 'Reconnecter / Changer de numéro' : 'Connecter via WhatsApp'}
          </>
        )}
      </button>

      {/* Note sécurité */}
      <p className="text-xs text-gray-400">
        L’échange OAuth se fait exclusivement de serveur à serveur. Aucune clé Meta n’est
        exposée dans le navigateur.
      </p>
    </div>
  )
}
