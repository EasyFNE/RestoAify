import { createContext, useContext, useEffect, useState } from 'react'
import { ids } from '../services/mockData.js'
import { supabase } from '../services/supabaseClient.js'

// Auth context.
// - VITE_DATA_SOURCE=mock  → mock login (n'importe quel email/mdp fonctionne)
// - VITE_DATA_SOURCE=supabase → vrai Supabase Auth (email + mdp réels requis)
//
// `currentUser` carries:
//   - id, email, full_name
//   - role: 'platform_admin' | 'tenant_owner' | 'tenant_admin' | 'manager' | ...
//   - scope: 'platform' | 'tenant'

const AuthContext = createContext(null)
const STORAGE_KEY = 'rsaas.auth.user'
const USE_SUPABASE = import.meta.env.VITE_DATA_SOURCE === 'supabase'

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  // ── Supabase : écoute les changements de session (login / logout / refresh)
  useEffect(() => {
    if (!USE_SUPABASE || !supabase) return

    // Récupère la session déjà active (refresh de page)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        _hydrateFromSupabase(session.user)
      }
    })

    // Écoute les changements d'état (connexion, déconnexion, expiration)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          _hydrateFromSupabase(session.user)
        } else {
          setCurrentUser(null)
          localStorage.removeItem(STORAGE_KEY)
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  // ── Mock : persiste l'utilisateur dans localStorage
  useEffect(() => {
    if (USE_SUPABASE) return
    if (currentUser) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentUser))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [currentUser])

  // Construit le currentUser depuis un user Supabase Auth
  // Adapte cette fonction à ta logique réelle de rôles (ex: table user_roles)
  function _hydrateFromSupabase(supaUser) {
    const meta = supaUser.user_metadata || {}
    const isPlatform = /platform/i.test(supaUser.email || '')
    const user = {
      id: supaUser.id,
      email: supaUser.email,
      full_name: meta.full_name || supaUser.email,
      role: isPlatform ? 'platform_admin' : (meta.role || 'tenant_owner'),
      scope: isPlatform ? 'platform' : 'tenant',
      tenantId: meta.tenant_id || null,
    }
    setCurrentUser(user)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  }

  // ── signIn
  async function signIn({ email, password }) {
    if (USE_SUPABASE) {
      // Vrai login Supabase
      if (!supabase) throw new Error('Supabase non configuré')
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      // _hydrateFromSupabase sera appelé par onAuthStateChange
      return data.user
    }

    // Mode mock : n'importe quel email/mdp fonctionne
    const isPlatform = /platform/i.test(email)
    const user = isPlatform
      ? {
          id: ids.USER_PLATFORM,
          email,
          full_name: 'Platform Admin',
          role: 'platform_admin',
          scope: 'platform',
          tenantId: null,
        }
      : {
          id: ids.USER_OWNER_LS,
          email,
          full_name: 'Awa Koné',
          role: 'tenant_owner',
          scope: 'tenant',
          tenantId: ids.TENANT_LE_SPOT,
        }
    setCurrentUser(user)
    return user
  }

  // ── signOut
  async function signOut() {
    if (USE_SUPABASE && supabase) {
      await supabase.auth.signOut()
    }
    setCurrentUser(null)
    localStorage.removeItem(STORAGE_KEY)
  }

  return (
    <AuthContext.Provider value={{ currentUser, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider')
  return ctx
}
