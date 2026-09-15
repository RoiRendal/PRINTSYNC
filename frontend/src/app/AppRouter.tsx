import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './layout/AppLayout';
import { AppProviders } from './providers/AppProviders';
import { useAuth } from '../features/users/state/AuthContext';
import LoginPage from '../features/auth/pages/LoginPage';
import { NAV_ITEMS } from '../shared/constants/navigation';
import { ErrorBoundary } from '../shared/components/feedback/ErrorBoundary';
import { LoadingState } from '../shared/components/feedback/LoadingState';

const Dashboard = lazy(() => import('../features/dashboard/pages/DashboardPage'));
const Inventory = lazy(() => import('../features/inventory/pages/InventoryPage'));
const POS = lazy(() => import('../features/orders/pages/POSPage'));
const Analytics = lazy(() => import('../features/analytics/pages/AnalyticsPage'));
const UserManagement = lazy(() => import('../features/users/pages/UserManagementPage'));
const Orders = lazy(() => import('../features/orders/pages/OrdersPage'));
const Settings = lazy(() => import('../features/settings/pages/SettingsPage'));
const Customers = lazy(() => import('../features/customers/pages/CustomersPage'));
const AuditLog = lazy(() => import('../features/audit/pages/AuditLogPage'));

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { currentUser, isSessionLoading } = useAuth();
  if (isSessionLoading) {
    return <LoadingState label="Restoring session" className="min-h-screen" />;
  }
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function ProtectedLayout() {
  return (
    <RequireAuth>
      <Layout>
        <Suspense fallback={<LoadingState label="Loading page" className="min-h-[60vh]" />}>
          <Outlet />
        </Suspense>
      </Layout>
    </RequireAuth>
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
