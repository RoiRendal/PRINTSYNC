import React from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
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
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/orders" element={<Orders />} />
                    <Route path="/inventory" element={<Inventory />} />
                    <Route path="/pos" element={<POS />} />
                    <Route path="/finance" element={<Finance />} />
                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="/users" element={<UserManagement />} />
                    <Route path="/settings" element={<Settings />} />
                  </Route>
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </BrowserRouter>
            </UserProvider>
          </InventoryProvider>
        </FinanceProvider>
      </BusinessBrandingProvider>
    </ThemeProvider>
  );
}

