import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { useTenant } from '../hooks/useTenant.js'

export default function Topbar({ scope }) {
  const { currentUser, signOut } = useAuth()
  const { currentTenant } = useTenant()
  const navigate = useNavigate()

  function handleSignOut() {
    signOut()
    navigate('/login', { replace: true })
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div className="text-sm text-gray-600">
        {scope === 'tenant' && currentTenant ? (
          <>
            <span className="text-gray-400">Tenant : </span>
            <span className="font-medium text-gray-900">{currentTenant.name}</span>
          </>
        ) : scope === 'platform' ? (
          <span className="font-medium text-gray-900">Platform Admin</span>
        ) : null}
      </div>
      <div className="flex items-center gap-4 text-sm">
        <div className="text-right">
          <div className="font-medium text-gray-900">{currentUser?.full_name}</div>
          <div className="text-xs text-gray-500">{currentUser?.email}</div>
        </div>
        <button onClick={handleSignOut} className="btn-secondary">Déconnexion</button>
      </div>
    </header>
  )
}
