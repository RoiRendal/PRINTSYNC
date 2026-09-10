import React from 'react';
import { InventoryProvider } from '../../features/inventory/state/InventoryContext';
import { DesignProvider } from '../../features/designs/state/DesignContext';
import { OrderProvider } from '../../features/orders/state/OrderContext';
import { UserProvider, useUserContext } from '../../features/users/state/UserContext';
import { BusinessBrandingProvider } from './BusinessBrandingProvider';
import { ThemeProvider } from './ThemeProvider';

function AuthenticatedDataProviders({ children }: { children: React.ReactNode }) {
  const { currentUser } = useUserContext();

  if (!currentUser) return <>{children}</>;

  return (
    <InventoryProvider>
      <DesignProvider>
        <OrderProvider>{children}</OrderProvider>
      </DesignProvider>
    </InventoryProvider>
  );
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <UserProvider>
        <BusinessBrandingProvider>
          <AuthenticatedDataProviders>{children}</AuthenticatedDataProviders>
        </BusinessBrandingProvider>
      </UserProvider>
    </ThemeProvider>
  );
}
