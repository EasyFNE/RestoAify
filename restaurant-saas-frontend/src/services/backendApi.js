// ─────────────────────────────────────────────────────────────────────────────
// RestoAify — Backend AI API client
// Pointe vers https://api.enigma-sys.com (tunnel Cloudflare)
//
// Endpoints disponibles :
//   GET  /health                       → vérifier que le backend est vivant
//   GET  /tools        (auth + tenant) → lister les outils IA disponibles
//   POST /tools/execute (auth + tenant) → exécuter un outil IA
//   POST /whatsapp/connect (auth + tenant) → Embedded Signup → upsert channel
//   GET  /whatsapp/channel (auth + tenant) → lire le channel WhatsApp du tenant
//
// Usage :
//   import { backendApi } from './backendApi.js'
//   const tools = await backendApi.getTools(accessToken, tenantId)
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'https://api.enigma-sys.com'

/**
 * Construit les headers communs pour les appels authentifiés.
 * @param {string} token       - Bearer token Supabase (session.access_token)
 * @param {string} tenantId    - UUID du tenant courant
 */
function authHeaders(token, tenantId) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'X-Tenant-Id': tenantId,
  }
}

/**
 * Gère les réponses HTTP et lance une erreur lisible si le backend répond en erreur.
 */
async function handleResponse(res) {
  if (!res.ok) {
    let message = `Erreur ${res.status}`
    try {
      const body = await res.json()
      message = body?.message || body?.error || message
    } catch (_) {}
    throw new Error(message)
  }
  return res.json()
}

export const backendApi = {
  /**
   * Vérifie que le backend est accessible.
   * Pas besoin d'auth — endpoint public.
   */
  async health() {
    const res = await fetch(`${BASE_URL}/health`)
    return handleResponse(res)
  },

  /**
   * Liste les outils IA disponibles pour ce tenant.
   * @param {string} token
   * @param {string} tenantId
   */
  async getTools(token, tenantId) {
    if (!token) throw new Error('Token requis')
    if (!tenantId) throw new Error('tenantId requis')

    const res = await fetch(`${BASE_URL}/tools`, {
      method: 'GET',
      headers: authHeaders(token, tenantId),
    })
    return handleResponse(res)
  },

  /**
   * Exécute un outil IA.
   * @param {string} token
   * @param {string} tenantId
   * @param {{ toolName: string, input: object }} payload
   */
  async executeTool(token, tenantId, payload) {
    if (!token) throw new Error('Token requis')
    if (!tenantId) throw new Error('tenantId requis')
    if (!payload?.toolName) throw new Error('toolName requis dans le payload')

    const res = await fetch(`${BASE_URL}/tools/execute`, {
      method: 'POST',
      headers: authHeaders(token, tenantId),
      body: JSON.stringify(payload),
    })
    return handleResponse(res)
  },

  /**
   * Échange le code OAuth Meta (Embedded Signup) contre un channel WhatsApp actif.
   * Crée ou met à jour le channel du tenant en base (upsert).
   *
   * @param {string} token          - Bearer token Supabase
   * @param {string} tenantId       - UUID du tenant
   * @param {{
   *   code: string,
   *   waba_id: string,
   *   phone_number_id: string,
   *   restaurant_id?: string | null
   * }} payload
   * @returns {Promise<{
   *   success: boolean,
   *   data: {
   *     channel_id: string,
   *     waba_id: string,
   *     phone_number_id: string,
   *     verified_display_name: string | null,
   *     verified_phone_number: string | null,
   *     status: string
   *   }
   * }>}
   */
  async connectWhatsApp(token, tenantId, payload) {
    if (!token) throw new Error('Token requis')
    if (!tenantId) throw new Error('tenantId requis')
    if (!payload?.code) throw new Error('code OAuth Meta requis')
    if (!payload?.waba_id) throw new Error('waba_id requis')
    if (!payload?.phone_number_id) throw new Error('phone_number_id requis')

    const res = await fetch(`${BASE_URL}/whatsapp/connect`, {
      method: 'POST',
      headers: authHeaders(token, tenantId),
      body: JSON.stringify({
        code: payload.code,
        waba_id: payload.waba_id,
        phone_number_id: payload.phone_number_id,
        restaurant_id: payload.restaurant_id ?? null,
      }),
    })
    return handleResponse(res)
  },

  /**
   * Récupère le channel WhatsApp actif du tenant (s'il existe).
   * Retourne null dans data si aucun channel n'est connecté.
   *
   * @param {string} token
   * @param {string} tenantId
   * @returns {Promise<{ success: boolean, data: object | null }>}
   */
  async getWhatsAppChannel(token, tenantId) {
    if (!token) throw new Error('Token requis')
    if (!tenantId) throw new Error('tenantId requis')

    const res = await fetch(`${BASE_URL}/whatsapp/channel`, {
      method: 'GET',
      headers: authHeaders(token, tenantId),
    })
    return handleResponse(res)
  },
}
