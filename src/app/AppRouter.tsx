import React from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './layout/AppLayout';
import { ThemeProvider } from './providers/ThemeProvider';
import { BusinessBrandingProvider } from './providers/BusinessBrandingProvider';
import { FinanceProvider } from '../features/finance/state/FinanceContext';
import { InventoryProvider } from '../features/inventory/state/InventoryContext';
import { UserProvider, useUserContext } from '../features/users/state/UserContext';
import Dashboard from '../features/dashboard/pages/DashboardPage';
import Inventory from '../features/inventory/pages/InventoryPage';
import POS from '../features/orders/pages/POSPage';
import Finance from '../features/finance/pages/FinancePage';
import Analytics from '../features/analytics/pages/AnalyticsPage';
import UserManagement from '../features/users/pages/UserManagementPage';
import Orders from '../features/orders/pages/OrdersPage';
import Settings from '../features/settings/pages/SettingsPage';
import LoginPage from '../features/auth/pages/LoginPage';
import { NAV_ITEMS } from '../shared/constants/navigation';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { currentUser } = useUserContext();
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function ProtectedLayout() {
  return (
    <RequireAuth>
      <Layout>
        <Outlet />
      </Layout>
    </RequireAuth>
  );
}

function NavigateToFirstAllowedPage() {
  const { currentUser } = useUserContext();
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  const firstAllowed = NAV_ITEMS.find((item) => currentUser.access.includes(item.key));
  return <Navigate to={firstAllowed?.path ?? '/login'} replace />;
}

function RequirePageAccess({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { canAccess } = useUserContext();
  if (!canAccess(location.pathname)) {
    return <NavigateToFirstAllowedPage />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <ThemeProvider>
      <BusinessBrandingProvider>
        <FinanceProvider>
          <InventoryProvider>
            <UserProvider>
              <BrowserRouter>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route element={<ProtectedLayout />}>
                    <Route path="/" element={<RequirePageAccess><Dashboard /></RequirePageAccess>} />
                    <Route path="/orders" element={<RequirePageAccess><Orders /></RequirePageAccess>} />
                    <Route path="/inventory" element={<RequirePageAccess><Inventory /></RequirePageAccess>} />
                    <Route path="/pos" element={<RequirePageAccess><POS /></RequirePageAccess>} />
                    <Route path="/finance" element={<RequirePageAccess><Finance /></RequirePageAccess>} />
                    <Route path="/analytics" element={<RequirePageAccess><Analytics /></RequirePageAccess>} />
                    <Route path="/users" element={<RequirePageAccess><UserManagement /></RequirePageAccess>} />
                    <Route path="/settings" element={<RequirePageAccess><Settings /></RequirePageAccess>} />
                  </Route>
                  <Route path="*" element={<NavigateToFirstAllowedPage />} />
                </Routes>
              </BrowserRouter>
            </UserProvider>
          </InventoryProvider>
        </FinanceProvider>
      </BusinessBrandingProvider>
    </ThemeProvider>
  );
}

