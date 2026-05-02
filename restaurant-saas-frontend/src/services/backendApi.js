// ─────────────────────────────────────────────────────────────────────────────
// RestoAify — Backend AI API client
// Pointe vers https://api.enigma-sys.com (tunnel Cloudflare)
//
// Endpoints disponibles :
//   GET  /health                       → vérifier que le backend est vivant
//   GET  /tools        (auth + tenant) → lister les outils IA disponibles
//   POST /tools/execute (auth + tenant) → exécuter un outil IA
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
}
