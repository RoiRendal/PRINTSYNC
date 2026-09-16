/**
 * Domain-level data-change bus.
 *
 * The zustand list stores are module singletons, so a mutation performed in one
 * feature is already visible to every other feature *in the same tab* — as long
 * as it patches the shared store slice. What that model cannot express is:
 *
 *   1. A change that originated somewhere else — another browser tab, another
 *      workstation, or another staff member's session.
 *   2. A derived view that reads its own endpoint rather than a store
 *      (analytics, POS transaction history, the audit log).
 *   3. A cross-domain side effect — ringing up a retail sale writes a payment,
 *      decrements inventory, and moves revenue on the dashboard, all at once.
 *
 * This module is the single place where "the data in domain X changed" is
 * announced. List stores subscribe in order to revalidate themselves; ad-hoc
 * hooks subscribe in order to refetch their own endpoints.
 *
 * It is deliberately synchronous, dependency-free, and untyped beyond a small
 * union — the revalidation helpers downstream already skip work when the local
 * cache is still fresh, so a chatty emitter is cheap.
 */

/** The server-backed domains a change can be attributed to. */
export type DataDomain =
  | 'orders'
  | 'inventory'
  | 'customers'
  | 'designs'
  | 'users'
  | 'payments'
  | 'settings';

export type DataChangeListener = (domains: readonly DataDomain[]) => void;

const listeners = new Set<DataChangeListener>();

/**
 * Subscribes to domain changes.
 *
 * @returns an unsubscribe function — always call it from an effect cleanup, or
 *          a long-lived page will accumulate dead listeners.
 */
export function subscribeToDataChanges(listener: DataChangeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Announces that one or more domains changed.
 *
 * Domains are batched into a single call on purpose: one user action that
 * touches several domains should wake each subscriber once, not once per
 * domain. Listeners are iterated over a copy so that a listener which
 * unsubscribes during dispatch cannot disturb the loop.
 */
export function emitDataChange(...domains: DataDomain[]): void {
  if (domains.length === 0) return;
  for (const listener of [...listeners]) {
    listener(domains);
  }
}

/** `true` when any of `domains` is in `changed`. Small helper for subscribers. */
export function includesAnyDomain(
  changed: readonly DataDomain[],
  domains: readonly DataDomain[],
): boolean {
  return domains.some((domain) => changed.includes(domain));
}
