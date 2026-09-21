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
import type { DataDomain } from '../../shared/store/dataEvents';

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
 *
 * @param canSeeUsers whether the session may open the Users page. The caller
 *                    passes the page key (`access.includes('users')`), which is
 *                    satisfied by either `users.read` or `users.manage` — so this
 *                    is a *visibility* check, not a capability check. It was named
 *                    `canManageUsers`, which suggested the narrower thing and would
 *                    have made the user store look like it should stop loading for
 *                    a read-only role.
 */
export function loadDataStores(canSeeUsers: boolean): void {
  void useCustomerStore.getState().ensureLoaded();
  void useInventoryStore.getState().ensureLoaded();
  void useDesignStore.getState().ensureLoaded();
  void useOrderStore.getState().ensureLoaded();
  if (canSeeUsers) {
    void useUserStore.getState().ensureLoaded();
  }
}

/**
 * Refreshes a store only if this user has actually loaded it.
 *
 * The guard matters: `users` is admin-only, so an unconditional refresh would
 * make a staff session hit an endpoint it is not authorised for and paint a 403
 * onto a page nobody opened. It also stops background triggers from eagerly
 * fetching collections the user has not visited yet — priming stays the job of
 * `loadDataStores()`.
 *
 * @param force bypass the store's `staleTime`. Only authoritative signals pass
 *              `true` — see `revalidateDataDomains`.
 */
function revalidateIfLoaded(
  store: { hasLoaded: boolean; revalidate: () => Promise<void>; forceRevalidate: () => Promise<void> },
  force: boolean,
): void {
  if (!store.hasLoaded) return;
  void (force ? store.forceRevalidate() : store.revalidate());
}

/**
 * Maps a domain announced on the data-change bus to the store that owns it.
 *
 * Domains without an owning list store — `payments` and `settings` — are
 * deliberately absent. Their consumers (`POSPage`'s transaction history, the
 * branding provider) subscribe to the bus directly, because they read bespoke
 * endpoints rather than a paginated collection.
 */
const DOMAIN_REVALIDATORS: Record<DataDomain, (force: boolean) => void> = {
  orders: (force) => revalidateIfLoaded(useOrderStore.getState(), force),
  inventory: (force) => revalidateIfLoaded(useInventoryStore.getState(), force),
  customers: (force) => revalidateIfLoaded(useCustomerStore.getState(), force),
  designs: (force) => revalidateIfLoaded(useDesignStore.getState(), force),
  users: (force) => revalidateIfLoaded(useUserStore.getState(), force),
  payments: () => {},
  settings: () => {},
};

/**
 * Refreshes every loaded store whose domain appears in `domains`.
 *
 * @param options.force skip each store's `staleTime` check.
 *
 * `force` exists because the freshness window and the push channel would
 * otherwise work against each other. A domain event is *not* a guess — it is
 * emitted only after a write committed, here or on another workstation — so
 * letting a 15-second `staleTime` swallow it would leave a cashier looking at
 * stock levels that are already wrong. Time-based triggers keep `force: false`,
 * because those genuinely are guesses and must stay rate-limited.
 */
export function revalidateDataDomains(
  domains: readonly DataDomain[],
  options?: { force?: boolean },
): void {
  const force = options?.force ?? false;
  const seen = new Set<DataDomain>();
  for (const domain of domains) {
    if (seen.has(domain)) continue;
    seen.add(domain);
    DOMAIN_REVALIDATORS[domain](force);
  }
}

/**
 * Refreshes every loaded store.
 *
 * Used by the time-based triggers (focus, visibility, connectivity, the
 * degraded-mode poll), which cannot know which domain changed and must respect
 * each store's `staleTime` — hence no `force`. Cheap when nothing is stale: each
 * store checks its own freshness before issuing a request.
 */
export function revalidateAllDataStores(): void {
  revalidateDataDomains(['orders', 'inventory', 'customers', 'designs', 'users']);
}
