import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './layout/AppLayout';
import { ThemeProvider } from './providers/ThemeProvider';
import { BusinessBrandingProvider } from './providers/BusinessBrandingProvider';
import { FinanceProvider } from '../features/finance/state/FinanceContext';
import { InventoryProvider } from '../features/inventory/state/InventoryContext';
import Dashboard from '../features/dashboard/pages/DashboardPage';
import Inventory from '../features/inventory/pages/InventoryPage';
import POS from '../features/orders/pages/POSPage';
import Finance from '../features/finance/pages/FinancePage';
import Analytics from '../features/analytics/pages/AnalyticsPage';
import UserManagement from '../features/users/pages/UserManagementPage';
import Orders from '../features/orders/pages/OrdersPage';
import Settings from '../features/settings/pages/SettingsPage';

export default function App() {
  return (
    <ThemeProvider>
      <BusinessBrandingProvider>
        <FinanceProvider>
          <InventoryProvider>
            <BrowserRouter>
              <Layout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/orders" element={<Orders />} />
                  <Route path="/inventory" element={<Inventory />} />
                  <Route path="/pos" element={<POS />} />
                  <Route path="/finance" element={<Finance />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/users" element={<UserManagement />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </Layout>
            </BrowserRouter>
          </InventoryProvider>
        </FinanceProvider>
      </BusinessBrandingProvider>
    </ThemeProvider>
  );
}

