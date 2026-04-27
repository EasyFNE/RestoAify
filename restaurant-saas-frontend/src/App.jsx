import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { TenantProvider } from './contexts/TenantContext.jsx'
import AppRouter from './router/index.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TenantProvider>
          <AppRouter />
        </TenantProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
