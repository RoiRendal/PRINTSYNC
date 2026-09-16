import React, { useEffect } from 'react';
import { loadDataStores, resetDataStores, useAuthStore } from '../stores';
import { useDataRevalidation } from '../hooks/useDataRevalidation';
import { useNotificationGenerator } from '../hooks/useNotificationGenerator';
import { BusinessBrandingProvider } from './BusinessBrandingProvider';
import { ThemeProvider } from './ThemeProvider';
import { NotificationProvider } from './NotificationProvider';

function NotificationGenerator() {
  useNotificationGenerator();
  return null;
}

/**
 * Bridges the zustand layer into the React tree.
 *
 * Replaces the previous tower of `OrderProvider` / `InventoryProvider` /
 * `CustomerProvider` / `DesignProvider` / `UserProvider` / `AuthProvider`
 * components: stores are module singletons, so the only thing React still has
 * to do is kick off the session restore and prime the shared collections once a
 * user is known. Pages then read state through selector hooks instead of
 * re-rendering the whole subtree on every change.
 */
function StoreBootstrap({ children }: { children: React.ReactNode }) {
  const currentUser = useAuthStore((state) => state.currentUser);
  const restoreSession = useAuthStore((state) => state.restoreSession);

  // Keeps every loaded collection current: on domain events raised by
  // mutations, when the workstation returns to the tab, and on a slow poll.
  // Disabled while signed out so the login screen never polls.
  useDataRevalidation(Boolean(currentUser));

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    if (!currentUser) {
      resetDataStores();
      return;
    }
    loadDataStores(currentUser.access.includes('users'));
  }, [currentUser]);

  return <>{children}</>;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <BusinessBrandingProvider>
        <NotificationProvider>
          <StoreBootstrap>
            <NotificationGenerator />
            {children}
          </StoreBootstrap>
        </NotificationProvider>
      </BusinessBrandingProvider>
    </ThemeProvider>
  );
}
