/**
 * WhatsAppPage.jsx
 *
 * Fix 1 : currentUser.tenantId (camelCase)
 * Fix 2 : token via supabase.auth.getSession()
 * Fix 3 : FB.event.subscribe → window.addEventListener('message')
 * Fix 4 : FB.login n'accepte qu'un callback SYNCHRONE — la logique async
 *          est extraite dans handleLoginResponse() appelée via .then()
 */

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth.js'
import { supabase } from '../../services/supabaseClient.js'
import { backendApi } from '../../services/backendApi.js'

const META_APP_ID      = import.meta.env.VITE_META_APP_ID    || ''
const META_CONFIG_ID   = import.meta.env.VITE_META_CONFIG_ID || ''
const META_SDK_VERSION = 'v21.0'

// ── Chargement SDK Meta (une seule fois) ──────────────────────────────────────
function loadFacebookSdk(appId, version) {
  return new Promise((resolve, reject) => {
    if (window.FB) { resolve(window.FB); return }
    window.fbAsyncInit = function () {
      window.FB.init({ appId, autoLogAppEvents: true, xfbml: true, version })
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

// ── Composant principal ────────────────────────────────────────────────────────
export default function WhatsAppPage() {
  const { currentUser } = useAuth()
  const tenantId = currentUser?.tenantId ?? null

  const [token, setToken]           = useState(null)
  const [tokenReady, setTokenReady] = useState(false)

  const [channel, setChannel]               = useState(null)
  const [loadingChannel, setLoadingChannel] = useState(false)
  const [connecting, setConnecting]         = useState(false)
  const [error, setError]                   = useState(null)
  const [success, setSuccess]               = useState(null)

  // Données WABA reçues via postMessage de la popup Meta
  const sessionInfoRef = useRef(null)

  // ── Résoudre le token Supabase ─────────────────────────────────────────────
  useEffect(() => {
    async function resolveToken() {
      if (!supabase) { setToken('mock-token'); setTokenReady(true); return }
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setToken(session?.access_token ?? null)
      } catch (e) {
        console.error('[WhatsAppPage] getSession:', e)
        setToken(null)
      } finally {
        setTokenReady(true)
      }
    }
    resolveToken()
  }, [])

  // ── Charger le channel existant ────────────────────────────────────────────
  useEffect(() => {
    if (!tokenReady || !token || !tenantId) { setLoadingChannel(false); return }
    setLoadingChannel(true)
    backendApi.getWhatsAppChannel(token, tenantId)
      .then(res => setChannel(res.data ?? null))
      .catch(err => console.warn('[WhatsAppPage] getWhatsAppChannel:', err.message))
      .finally(() => setLoadingChannel(false))
  }, [tokenReady, token, tenantId])

  const isMetaConfigured = Boolean(META_APP_ID && META_CONFIG_ID)

  // ── Listener postMessage Meta ──────────────────────────────────────────────
  // Meta envoie waba_id + phone_number_id via postMessage depuis la popup.
  useEffect(() => {
    function onMessage(event) {
      if (!event.origin.includes('facebook.com')) return
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        if (data?.type === 'WA_EMBEDDED_SIGNUP' && data?.event === 'FINISH') {
          const info = data?.data ?? {}
          if (info.waba_id || info.phone_number_id) {
            sessionInfoRef.current = info
            console.debug('[WhatsApp] sessionInfo reçu (WA_EMBEDDED_SIGNUP):', info)
          }
        }
        // Certaines versions Meta envoient waba_id au top level
        if (data?.waba_id && data?.phone_number_id) {
          sessionInfoRef.current = data
          console.debug('[WhatsApp] sessionInfo reçu (direct):', data)
        }
      } catch (_) { /* message non-JSON, ignoré */ }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // ── Traitement async APRÈS le callback FB.login ────────────────────────────
  // Séparé car FB.login n'accepte QUE des callbacks synchrones.
  async function handleLoginResponse(response) {
    if (response.status !== 'connected' || !response.authResponse?.code) {
      setError('Connexion annulée ou refusée par Meta.')
      setConnecting(false)
      return
    }

    const code = response.authResponse.code

    // Attendre jusqu'à 500 ms que le postMessage sessionInfo arrive
    await new Promise(r => setTimeout(r, 500))
    const sessionInfo = sessionInfoRef.current

    if (!sessionInfo?.waba_id || !sessionInfo?.phone_number_id) {
      setError(
        'Informations WABA manquantes (waba_id / phone_number_id). ' +
        'Assurez-vous d'avoir complété toutes les étapes du flux Meta.'
      )
      setConnecting(false)
      return
    }

    try {
      const res = await backendApi.connectWhatsApp(token, tenantId, {
        code,
        waba_id:         sessionInfo.waba_id,
        phone_number_id: sessionInfo.phone_number_id,
        restaurant_id:   null,
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
        setSuccess('Numéro WhatsApp Business connecté avec succès !')
      } else {
        setError(res.error?.message || 'Erreur lors de la connexion.')
      }
    } catch (err) {
      setError(err.message || 'Erreur serveur lors de la connexion.')
    } finally {
      setConnecting(false)
    }
  }

  // ── Lancement Embedded Signup ──────────────────────────────────────────────
  async function handleConnect() {
    setError(null)
    setSuccess(null)
    setConnecting(true)
    sessionInfoRef.current = null

    try {
      const FB = await loadFacebookSdk(META_APP_ID, META_SDK_VERSION)

      if (typeof FB?.login !== 'function') {
        throw new Error('SDK Meta chargé mais FB.login indisponible. Rechargez la page.')
      }

      // ⚠️ Le callback de FB.login DOIT être synchrone.
      // On délègue immédiatement à handleLoginResponse via .then() pour l'async.
      FB.login(
        (response) => {
          handleLoginResponse(response).catch(err => {
            setError(err.message || 'Erreur inattendue.')
            setConnecting(false)
          })
        },
        {
          config_id: META_CONFIG_ID,
          response_type: 'code',
          override_default_response_type: true,
          extras: { setup: {}, sessionInfoVersion: 3 },
        },
      )
    } catch (err) {
      setError(err.message || "Impossible d'initialiser le SDK Meta.")
      setConnecting(false)
    }
  }

  // ── Rendu ──────────────────────────────────────────────────────────────────
  if (!tokenReady) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4 sm:px-6">
        <PageHeader />
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 flex items-center gap-3 text-gray-500 text-sm">
          <Spinner /> Vérification de la session…
        </div>
      </div>
    )
  }

  if (!token || !tenantId) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4 sm:px-6">
        <PageHeader />
        <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-6 space-y-1">
          <p className="text-sm text-red-600 font-medium">Session invalide ou tenant introuvable.</p>
          <p className="text-xs text-gray-400">
            {!token && <span>Token absent. </span>}
            {!tenantId && <span>tenantId absent. </span>}
            Veuillez vous reconnecter.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 sm:px-6 space-y-6">
      <PageHeader />

      {!isMetaConfigured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Configuration incomplète :</strong>{' '}
          <code className="font-mono text-xs">VITE_META_APP_ID</code> et{' '}
          <code className="font-mono text-xs">VITE_META_CONFIG_ID</code> sont manquants —
          le bouton de connexion est désactivé.
        </div>
      )}

      {/* Statut channel */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100">
        <div className="flex items-center gap-3 px-6 py-4">
          <WaIcon />
          <div>
            <h2 className="text-base font-semibold text-gray-900">Numéro connecté</h2>
            <p className="text-xs text-gray-400">Source de vérité pour l'envoi de messages WhatsApp.</p>
          </div>
        </div>
        <div className="px-6 py-5">
          {loadingChannel ? (
            <div className="flex items-center gap-2 text-gray-500 text-sm"><Spinner /> Chargement…</div>
          ) : channel ? (
            <ChannelCard channel={channel} />
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center">
              <WaIcon className="mx-auto mb-2 h-8 w-8 opacity-20" />
              <p className="text-sm text-gray-500">Aucun numéro WhatsApp Business connecté.</p>
              <p className="text-xs text-gray-400 mt-1">Cliquez sur le bouton ci-dessous pour démarrer la configuration.</p>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex gap-2 items-start">
          <span className="mt-0.5">⚠️</span><span>{error}</span>
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 flex gap-2 items-start">
          <span>✅</span><span>{success}</span>
        </div>
      )}

      {/* Action */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">
          {channel ? 'Reconnecter / Changer de numéro' : 'Connecter WhatsApp Business'}
        </h2>
        <p className="text-sm text-gray-500">
          {channel
            ? "Lancez le flux Meta pour associer un nouveau numéro. L'ancien channel sera remplacé."
            : 'Lancez le flux Meta Embedded Signup pour autoriser RestoAify à envoyer des messages en votre nom.'}
        </p>
        <button
          type="button"
          onClick={handleConnect}
          disabled={connecting || !isMetaConfigured}
          className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] hover:bg-[#1da851] active:bg-[#178a43] disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2.5 text-sm font-semibold text-white transition-colors"
        >
          {connecting
            ? <><Spinner className="h-4 w-4" /> Connexion en cours…</>
            : <><WaIconSmall />{channel ? 'Reconnecter' : 'Connecter via WhatsApp'}</>
          }
        </button>
      </div>

      {/* Panel debug dev only */}
      {import.meta.env.DEV && (
        <details className="text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg px-4 py-3">
          <summary className="cursor-pointer font-medium text-gray-500">Debug session (dev only)</summary>
          <div className="mt-2 space-y-1 font-mono">
            <div>tenantId       : <span className="text-gray-700">{tenantId ?? 'null'}</span></div>
            <div>token          : <span className="text-gray-700">{token ? `${token.slice(0, 20)}…` : 'null'}</span></div>
            <div>META_APP_ID    : <span className="text-gray-700">{META_APP_ID || 'manquant'}</span></div>
            <div>META_CONFIG_ID : <span className="text-gray-700">{META_CONFIG_ID || 'manquant'}</span></div>
          </div>
        </details>
      )}

      <p className="text-xs text-gray-400 text-center">
        L'échange OAuth se fait exclusivement de serveur à serveur.
        Aucune clé Meta n'est exposée dans le navigateur.
      </p>
    </div>
  )
}

// ── Sous-composants ────────────────────────────────────────────────────────────

function PageHeader() {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-bold text-gray-900">WhatsApp Business</h1>
      <p className="mt-1 text-sm text-gray-500">
        Connectez votre compte WhatsApp Business via Meta Embedded Signup.
      </p>
    </div>
  )
}

function ChannelCard({ channel }) {
  const statusColor =
    channel.status === 'active'  ? 'bg-green-500' :
    channel.status === 'pending' ? 'bg-amber-400'  : 'bg-gray-400'
  const statusLabel =
    channel.status === 'active'  ? 'Actif'      :
    channel.status === 'pending' ? 'En attente' : (channel.status ?? 'Inconnu')
  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full inline-block ${statusColor}`} />
        <span className="text-sm font-semibold text-green-800">{statusLabel}</span>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {channel.verified_display_name && (<><dt className="text-gray-500">Nom affiché</dt><dd className="font-medium text-gray-900">{channel.verified_display_name}</dd></>)}
        {channel.verified_phone_number && (<><dt className="text-gray-500">Numéro</dt><dd className="font-medium text-gray-900">{channel.verified_phone_number}</dd></>)}
        {channel.waba_id && (<><dt className="text-gray-500">WABA ID</dt><dd className="font-mono text-xs text-gray-700 break-all">{channel.waba_id}</dd></>)}
        {channel.phone_number_id && (<><dt className="text-gray-500">Phone Number ID</dt><dd className="font-mono text-xs text-gray-700 break-all">{channel.phone_number_id}</dd></>)}
        {channel.connected_at && (<><dt className="text-gray-500">Connecté le</dt><dd className="text-gray-700">{new Date(channel.connected_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</dd></>)}
      </dl>
    </div>
  )
}

function Spinner({ className = 'h-5 w-5' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  )
}

function WaIcon({ className = 'h-8 w-8' }) {
  return (
    <svg viewBox="0 0 32 32" className={`flex-shrink-0 ${className}`} aria-label="WhatsApp">
      <circle cx="16" cy="16" r="16" fill="#25D366" />
      <path d="M16 7.5a8.5 8.5 0 00-7.41 12.68L7.5 24.5l4.46-1.06A8.5 8.5 0 1016 7.5zm0 15.5a7 7 0 01-3.56-.97l-.25-.15-2.65.63.66-2.58-.17-.27A7 7 0 1116 23zm3.84-5.2c-.21-.1-1.24-.61-1.43-.68-.19-.07-.33-.1-.47.1-.14.21-.54.68-.66.82-.12.14-.24.16-.45.05-.21-.1-.88-.32-1.68-1.03-.62-.55-1.04-1.23-1.16-1.44-.12-.21-.01-.32.09-.43.09-.1.21-.25.31-.38.1-.13.13-.21.2-.35.07-.14.03-.27-.02-.38-.05-.1-.47-1.14-.64-1.56-.17-.4-.34-.35-.47-.36-.12 0-.26-.01-.4-.01s-.37.05-.56.27c-.19.21-.74.72-.74 1.76s.76 2.04.87 2.18c.1.14 1.5 2.28 3.63 3.2.51.22.91.35 1.22.45.51.16.98.14 1.35.08.41-.06 1.24-.5 1.42-.99.17-.48.17-.9.12-.99-.06-.09-.2-.14-.41-.24z" fill="#fff" />
    </svg>
  )
}

function WaIconSmall() {
  return (
    <svg viewBox="0 0 32 32" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M16 7.5a8.5 8.5 0 00-7.41 12.68L7.5 24.5l4.46-1.06A8.5 8.5 0 1016 7.5z" />
    </svg>
  )
}
