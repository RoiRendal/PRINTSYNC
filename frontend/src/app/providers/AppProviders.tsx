import React from 'react';
import { InventoryProvider } from '../../features/inventory/state/InventoryContext';
import { DesignProvider } from '../../features/designs/state/DesignContext';
import { OrderProvider } from '../../features/orders/state/OrderContext';
import { UserProvider } from '../../features/users/state/UserContext';
import { BusinessBrandingProvider } from './BusinessBrandingProvider';
import { ThemeProvider } from './ThemeProvider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <BusinessBrandingProvider>
        <InventoryProvider>
          <DesignProvider>
            <OrderProvider>
              <UserProvider>{children}</UserProvider>
            </OrderProvider>
          </DesignProvider>
        </InventoryProvider>
      </BusinessBrandingProvider>
    </ThemeProvider>
  );
}
