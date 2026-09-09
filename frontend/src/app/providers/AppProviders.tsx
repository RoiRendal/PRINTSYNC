import React from 'react';
import { InventoryProvider } from '../../features/inventory/state/InventoryContext';
import { UserProvider } from '../../features/users/state/UserContext';
import { BusinessBrandingProvider } from './BusinessBrandingProvider';
import { ThemeProvider } from './ThemeProvider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <BusinessBrandingProvider>
        <InventoryProvider>
          <UserProvider>{children}</UserProvider>
        </InventoryProvider>
      </BusinessBrandingProvider>
    </ThemeProvider>
  );
}
