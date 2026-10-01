import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './layout/AppLayout';
import { AppProviders } from './providers/AppProviders';
import { useAuth } from '../app/stores/useAuthStore';
import LoginPage from '../features/auth/pages/LoginPage';
import { NAV_ITEMS } from '../shared/constants/navigation';
import { ErrorBoundary } from '../shared/components/feedback/ErrorBoundary';
import { PageSkeleton } from '../shared/components/feedback/PageSkeleton';

const Dashboard = lazy(() => import('../features/dashboard/pages/DashboardPage'));
const Inventory = lazy(() => import('../features/inventory/pages/InventoryPage'));
const POS = lazy(() => import('../features/orders/pages/POSPage'));
const Analytics = lazy(() => import('../features/analytics/pages/AnalyticsPage'));
const UserManagement = lazy(() => import('../features/users/pages/UserManagementPage'));
const Orders = lazy(() => import('../features/orders/pages/OrdersPage'));
const Settings = lazy(() => import('../features/settings/pages/SettingsPage'));
const Customers = lazy(() => import('../features/customers/pages/CustomersPage'));
const AuditLog = lazy(() => import('../features/audit/pages/AuditLogPage'));

/**
 * The authenticated shell.
 *
 * The order of the two conditions is the whole point. The shell renders even
 * while the session is unknown, because its frame — sidebar column, header, page
 * toolbar — is already decided; only the two things that depend on WHO is signed
 * in are not. `Layout` takes `navLoading` for exactly that, so the boot screen is
 * this layout with placeholders in it rather than a second copy of the layout
 * that could drift away from the real one.
 *
 * What stood here before was a full-screen spinner gated ahead of `Layout`, so
 * the shell could not paint until the session call returned: the window showed
 * nothing, then a spinner, then the app. Now the frame is up from the first
 * commit and only its contents fill in.
 *
 * `!currentUser` is checked AFTER the loading flag, so a signed-out visitor is
 * redirected rather than left looking at the shell.
 */
function ProtectedLayout() {
  const { currentUser, isSessionLoading } = useAuth();

  return (
    <Layout navLoading={isSessionLoading || !currentUser}>
      {isSessionLoading ? (
        <PageSkeleton />
      ) : currentUser ? (
        <Suspense fallback={<PageSkeleton className="min-h-[60vh]" />}>
          <Outlet />
        </Suspense>
      ) : (
        <Navigate to="/login" replace />
      )}
    </Layout>
  );
}

function NavigateToFirstAllowedPage() {
  const { currentUser } = useAuth();
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  const firstAllowed = NAV_ITEMS.find((item) => currentUser.access.includes(item.key));
  return <Navigate to={firstAllowed?.path ?? '/login'} replace />;
}

function RequirePageAccess({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { canAccess } = useAuth();
  if (!canAccess(location.pathname)) {
    return <NavigateToFirstAllowedPage />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProviders>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedLayout />}>
              <Route path="/" element={<RequirePageAccess><Dashboard /></RequirePageAccess>} />
              <Route path="/orders" element={<RequirePageAccess><Orders /></RequirePageAccess>} />
              <Route path="/inventory" element={<RequirePageAccess><Inventory /></RequirePageAccess>} />
              <Route path="/pos" element={<RequirePageAccess><POS /></RequirePageAccess>} />
              <Route path="/analytics" element={<RequirePageAccess><Analytics /></RequirePageAccess>} />
              <Route path="/customers" element={<RequirePageAccess><Customers /></RequirePageAccess>} />
              <Route path="/users" element={<RequirePageAccess><UserManagement /></RequirePageAccess>} />
              <Route path="/audit" element={<RequirePageAccess><AuditLog /></RequirePageAccess>} />
              <Route path="/settings" element={<RequirePageAccess><Settings /></RequirePageAccess>} />
            </Route>
            <Route path="*" element={<NavigateToFirstAllowedPage />} />
          </Routes>
        </BrowserRouter>
      </AppProviders>
    </ErrorBoundary>
  );
}
