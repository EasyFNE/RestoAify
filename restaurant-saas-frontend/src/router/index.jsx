import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import AppLayout from '../layouts/AppLayout.jsx'
import AuthLayout from '../layouts/AuthLayout.jsx'

import LoginPage from '../pages/LoginPage.jsx'
import RegisterPage from '../pages/RegisterPage.jsx'
import SetPasswordPage from '../pages/SetPasswordPage.jsx'
import NotFoundPage from '../pages/NotFoundPage.jsx'
import ComingSoonPage from '../pages/ComingSoonPage.jsx'

// Platform pages
import PlatformDashboard from '../pages/platform/PlatformDashboard.jsx'
import TenantsListPage from '../pages/platform/TenantsListPage.jsx'
import TenantDetailPage from '../pages/platform/TenantDetailPage.jsx'
import PlatformSettingsPage from '../pages/platform/PlatformSettingsPage.jsx'
import PlatformAuditPage from '../pages/platform/PlatformAuditPage.jsx'

// Tenant pages
import TenantDashboard from '../pages/tenant/TenantDashboard.jsx'
import MyTenantPage from '../pages/tenant/MyTenantPage.jsx'
import RestaurantsPage from '../pages/tenant/RestaurantsPage.jsx'
import RestaurantDetailPage from '../pages/tenant/RestaurantDetailPage.jsx'
import UsersPage from '../pages/tenant/UsersPage.jsx'
import RestaurantAccessPage from '../pages/tenant/RestaurantAccessPage.jsx'
import ModulesPage from '../pages/tenant/ModulesPage.jsx'
import SettingsPage from '../pages/tenant/SettingsPage.jsx'
import AuditPage from '../pages/tenant/AuditPage.jsx'
import BillingPage from '../pages/tenant/BillingPage.jsx'

// Operations pages (v1)
import ConversationsPage from '../pages/tenant/ConversationsPage.jsx'
import ConversationDetailPage from '../pages/tenant/ConversationDetailPage.jsx'
import ContactsPage from '../pages/tenant/ContactsPage.jsx'
import ContactDetailPage from '../pages/tenant/ContactDetailPage.jsx'
import OrdersPage from '../pages/tenant/OrdersPage.jsx'
import OrderDetailPage from '../pages/tenant/OrderDetailPage.jsx'

// Route guard
function Protected({ children, allowedScope }) {
  const { currentUser } = useAuth()
  if (!currentUser) return <Navigate to="/login" replace />
  if (allowedScope && currentUser.scope !== allowedScope && currentUser.scope !== 'platform') {
    return <Navigate to="/app" replace />
  }
  return children
}

// Root redirect
function RootRedirect() {
  const { currentUser } = useAuth()
  if (!currentUser) return <Navigate to="/login" replace />
  return <Navigate to={currentUser.scope === 'platform' ? '/platform' : '/app'} replace />
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />

      {/* Public auth routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login"        element={<LoginPage />} />
        <Route path="/register"     element={<RegisterPage />} />
        <Route path="/set-password" element={<SetPasswordPage />} />
      </Route>

      {/* Platform scope */}
      <Route
        element={
          <Protected allowedScope="platform">
            <AppLayout scope="platform" />
          </Protected>
        }
      >
        <Route path="/platform"             element={<PlatformDashboard />} />
        <Route path="/platform/tenants"     element={<TenantsListPage />} />
        <Route path="/platform/tenants/:id" element={<TenantDetailPage />} />
        <Route path="/platform/settings"    element={<PlatformSettingsPage />} />
        <Route path="/platform/audit"       element={<PlatformAuditPage />} />
      </Route>

      {/* Tenant scope */}
      <Route
        element={
          <Protected>
            <AppLayout scope="tenant" />
          </Protected>
        }
      >
        <Route path="/app"                       element={<TenantDashboard />} />
        <Route path="/app/tenant"                element={<MyTenantPage />} />
        <Route path="/app/restaurants"           element={<RestaurantsPage />} />
        <Route path="/app/restaurants/:id"       element={<RestaurantDetailPage />} />
        <Route path="/app/users"                 element={<UsersPage />} />
        <Route path="/app/restaurant-access"     element={<RestaurantAccessPage />} />
        <Route path="/app/modules"               element={<ModulesPage />} />
        <Route path="/app/billing"               element={<BillingPage />} />
        <Route path="/app/settings"              element={<SettingsPage />} />
        <Route path="/app/audit"                 element={<AuditPage />} />

        {/* Operations — v1 */}
        <Route path="/app/conversations"       element={<ConversationsPage />} />
        <Route path="/app/conversations/:id"   element={<ConversationDetailPage />} />
        <Route path="/app/customers"           element={<ContactsPage />} />
        <Route path="/app/customers/:id"       element={<ContactDetailPage />} />
        <Route path="/app/orders"              element={<OrdersPage />} />
        <Route path="/app/orders/:id"          element={<OrderDetailPage />} />

        {/* Coming soon */}
        <Route path="/app/reservations"  element={<ComingSoonPage moduleKey="reservations" />} />
        <Route path="/app/catering"      element={<ComingSoonPage moduleKey="catering" />} />
        <Route path="/app/healthy"       element={<ComingSoonPage moduleKey="healthy" />} />
        <Route path="/app/channels"      element={<ComingSoonPage moduleKey="channels" />} />
        <Route path="/app/whatsapp"      element={<ComingSoonPage moduleKey="whatsapp" />} />
        <Route path="/app/integrations"  element={<ComingSoonPage moduleKey="integrations" />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
