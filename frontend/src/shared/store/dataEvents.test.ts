// @vitest-environment node
/**
 * The domain bus is how a change made on one workstation reaches the screens on
 * every other. It is tiny, and that is the point — but two of its properties are
 * load-bearing and easy to lose in a refactor:
 *
 *   - A listener must not be able to break the dispatch for the listeners after
 *     it. If one did, the list stores would stop revalidating and the whole app
 *     would quietly go stale with nothing in the UI to say so.
 *   - The runtime domain list must stay in step with the shared type. Adding a
 *     domain to `@printsync/shared-types` without listing it here would make
 *     every event for it vanish at the boundary, because `isDataDomain` would
 *     reject it.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DATA_DOMAINS,
  emitDataChange,
  includesAnyDomain,
  isDataDomain,
  subscribeToDataChanges,
  type DataChangeListener,
} from './dataEvents';

const subscriptions: Array<() => void> = [];

/** Subscribes and registers the teardown, so no listener leaks between tests. */
function subscribe(listener: DataChangeListener): () => void {
  const stop = subscribeToDataChanges(listener);
  subscriptions.push(stop);
  return stop;
}

afterEach(() => {
  while (subscriptions.length > 0) subscriptions.pop()?.();
});

describe('emitDataChange', () => {
  it('delivers the changed domains to a subscriber', () => {
    const seen: Array<readonly string[]> = [];
    subscribe((domains) => seen.push(domains));

    emitDataChange('orders');

    expect(seen).toEqual([['orders']]);
  });

  it('batches several domains into a single notification', () => {
    // A retail sale touches two domains. Waking each subscriber once — rather
    // than once per domain — is what stops a sale causing two refetch storms.
    const seen: Array<readonly string[]> = [];
    subscribe((domains) => seen.push(domains));

    emitDataChange('payments', 'inventory');

    expect(seen).toEqual([['payments', 'inventory']]);
  });

  it('does nothing when no domain is given', () => {
    const listener = vi.fn();
    subscribe(listener);

    emitDataChange();

    expect(listener).not.toHaveBeenCalled();
  });

  it('stops delivering after unsubscribe', () => {
    const listener = vi.fn();
    const stop = subscribe(listener);

    emitDataChange('orders');
    stop();
    emitDataChange('orders');

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('isolates a listener that throws', () => {
    // The failure this prevents: a component that unmounted mid-dispatch throws,
    // every subscriber after it is skipped, and the page stops updating with no
    // visible cause.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const after = vi.fn();
    subscribe(() => {
      throw new Error('subscriber exploded');
    });
    subscribe(after);

    expect(() => emitDataChange('inventory')).not.toThrow();

    expect(after).toHaveBeenCalledWith(['inventory']);
    expect(consoleError).toHaveBeenCalled();
  });

  it('still reaches later listeners when an earlier one unsubscribes mid-dispatch', () => {
    const calls: string[] = [];
    let stopSecond: () => void = () => {};

    const stopFirst = subscribe(() => {
      calls.push('first');
      // Mutating the subscriber set while it is being dispatched is exactly what
      // the copy-of-listeners iteration exists to survive.
      stopSecond();
    });
    stopSecond = subscribe(() => calls.push('second'));

    emitDataChange('customers');

    expect(calls).toEqual(['first', 'second']);
    stopFirst();
  });
});

describe('domain validation', () => {
  it('accepts every domain in the runtime list', () => {
    for (const domain of DATA_DOMAINS) {
      expect(isDataDomain(domain)).toBe(true);
    }
  });

  it('rejects anything that is not a known domain', () => {
    // The SSE payload crosses a network boundary, so this is the guard that
    // stops a stray string indexing the revalidation registry and being called
    // as a function.
    expect(isDataDomain('payments.transactions')).toBe(false);
    expect(isDataDomain('Orders')).toBe(false);
    expect(isDataDomain('')).toBe(false);
    expect(isDataDomain(null)).toBe(false);
    expect(isDataDomain(42)).toBe(false);
    expect(isDataDomain({ domain: 'orders' })).toBe(false);
  });

  it('covers exactly the domains the app has stores or bespoke views for', () => {
    // `DOMAIN_COVERAGE` already forces this at compile time; asserting it here
    // means a careless `as` cast or a spread cannot slip past that.
    expect([...DATA_DOMAINS].sort()).toEqual(
      ['customers', 'designs', 'inventory', 'orders', 'payments', 'settings', 'users'],
    );
  });
});

describe('includesAnyDomain', () => {
  it('finds an overlap regardless of order', () => {
    expect(includesAnyDomain(['orders', 'inventory'], ['inventory'])).toBe(true);
    expect(includesAnyDomain(['payments'], ['orders', 'payments'])).toBe(true);
  });

  it('is false when the sets are disjoint, or either is empty', () => {
    expect(includesAnyDomain(['orders'], ['inventory'])).toBe(false);
    expect(includesAnyDomain([], ['orders'])).toBe(false);
    expect(includesAnyDomain(['orders'], [])).toBe(false);
  });
});
