/**
 * Global cross-cutting state.
 *
 * Data that is shared across features (session + the server-backed collections
 * that several pages read) lives here as zustand stores. UI-scoped state
 * (theme, notifications, business branding) stays in React Context under
 * `app/providers`.
 */
export { useAuth, useAuthStore } from './useAuthStore';
export { useOrders, useOrderStore } from './useOrderStore';
export { useInventory, useInventoryStore } from './useInventoryStore';
export { useCustomers, useCustomerStore } from './useCustomerStore';
export { useDesigns, useDesignStore } from './useDesignStore';
export { useUserContext, useUserStore } from './useUserStore';

import { useCustomerStore } from './useCustomerStore';
import { useDesignStore } from './useDesignStore';
import { useInventoryStore } from './useInventoryStore';
import { useOrderStore } from './useOrderStore';
import { useUserStore } from './useUserStore';

/**
 * Clears every cached collection. Called when the session ends so a different
 * user signing in cannot see the previous account's data.
 */
export function resetDataStores(): void {
  useCustomerStore.getState().resetList();
  useInventoryStore.getState().resetList();
  useDesignStore.getState().resetList();
  useOrderStore.getState().resetList();
  useUserStore.getState().resetList();
}

/**
 * Loads the collections the app needs once a session exists. Each store is a
 * no-op when it already holds data, so this is safe to run on every auth change.
 */
export function loadDataStores(canManageUsers: boolean): void {
  void useCustomerStore.getState().ensureLoaded();
  void useInventoryStore.getState().ensureLoaded();
  void useDesignStore.getState().ensureLoaded();
  void useOrderStore.getState().ensureLoaded();
  if (canManageUsers) {
    void useUserStore.getState().ensureLoaded();
  }
}
