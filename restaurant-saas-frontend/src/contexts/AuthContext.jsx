import { createContext, useContext, useEffect, useState } from 'react'
import { ids } from '../services/mockData.js'

// Minimal auth context. In v1 we accept any login (mock), but the structure
// supports plugging real Supabase auth later (`supabase.auth.signInWithPassword`).
//
// `currentUser` carries:
//   - id, email, full_name
//   - role: simplified role string used for menu filtering
//          ('platform_admin' | 'tenant_owner' | 'tenant_admin' | 'manager' | ...)
//   - scope: 'platform' | 'tenant'

const AuthContext = createContext(null)

const STORAGE_KEY = 'rsaas.auth.user'

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentUser))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [currentUser])

  // Mock login: any email works. Email containing 'platform' becomes platform admin.
  async function signIn({ email }) {
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

  function signOut() {
    setCurrentUser(null)
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
