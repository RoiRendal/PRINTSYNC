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
 * Events arrive from two sources, and both use `emitDataChange`:
 *
 *   - a mutation this tab just performed, and
 *   - the server push channel, which reports a change made anywhere.
 *
 * It is deliberately synchronous, dependency-free, and untyped beyond a small
 * union — the revalidation helpers downstream already skip work when the local
 * cache is still fresh, so a chatty emitter is cheap.
 */

import type { DataDomain } from '@printsync/shared-types';

/**
 * The shared union is the source of truth for the *type*; this file owns the
 * runtime list, because `@printsync/shared-types` is consumed as a type-only
 * dependency and therefore cannot export a value the browser could inspect.
 *
 * `DOMAIN_COVERAGE` is what keeps the two in step: it is a `Record` keyed by
 * every member of the union, so adding a domain to `dataEvent.ts` without
 * listing it here is a **compile error**, not a silently unhandled event.
 */
const DOMAIN_COVERAGE: Record<DataDomain, true> = {
  orders: true,
  inventory: true,
  customers: true,
  designs: true,
  users: true,
  payments: true,
  settings: true,
};

/** Every domain, as a runtime value. Order follows `DOMAIN_COVERAGE`. */
export const DATA_DOMAINS = Object.keys(DOMAIN_COVERAGE) as readonly DataDomain[];

/**
 * Narrows an untrusted value — a parsed SSE payload, say — to a `DataDomain`.
 *
 * The revalidation registry is a plain object lookup, so a stray string would
 * resolve to `undefined` and be called as a function. Validating at the
 * boundary is cheaper than defending every consumer.
 */
export function isDataDomain(value: unknown): value is DataDomain {
  return typeof value === 'string' && (DATA_DOMAINS as readonly string[]).includes(value);
}

export type { DataDomain };

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
 *
 * A listener that throws is logged and skipped, exactly as the server-side bus
 * does it. Without that, one broken subscriber — a component that unmounted
 * mid-dispatch, a handler reading a field that a failed fetch left undefined —
 * would silently swallow the notification for every subscriber after it,
 * including the list stores. The symptom would be a page that quietly stops
 * updating, with nothing in the UI to explain why. Isolating the failure keeps
 * live updates working for everything else.
 */
export function emitDataChange(...domains: DataDomain[]): void {
  if (domains.length === 0) return;
  for (const listener of [...listeners]) {
    try {
      listener(domains);
    } catch (error) {
      console.error('[data-events] listener threw while handling a change', {
        domains,
        error,
      });
    }
  }
}

/** `true` when any of `domains` is in `changed`. Small helper for subscribers. */
export function includesAnyDomain(
  changed: readonly DataDomain[],
  domains: readonly DataDomain[],
): boolean {
  return domains.some((domain) => changed.includes(domain));
}
