/**
 * The "syncing" indicator.
 *
 * Two things are easy to get wrong here and neither shows up as a failure:
 * showing it on every refresh turns it into flicker that staff learn to ignore,
 * and never showing it leaves the app refreshing silently — which is how someone
 * ends up making a decision on numbers that were already out of date.
 *
 * So the delay is the feature, not an optimisation, and it is what these tests
 * pin down.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInventoryStore } from '../stores/useInventoryStore';
import { useOrderStore } from '../stores/useOrderStore';
import { SYNC_INDICATOR_DELAY_MS, useIsSyncing } from './useIsSyncing';

/**
 * Flips a store's background-refresh flag, as a real fetch would.
 *
 * Takes a callback rather than the store itself: the two stores have different
 * state shapes, so a union of them has no callable `setState`. Letting each call
 * site name its own store keeps this helper honest and type-safe.
 */
function setRevalidating(apply: () => void): void {
  act(() => {
    apply();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  // The stores are module singletons, so leaving a flag set would leak into the
  // next test — and into anything else running in this file.
  useInventoryStore.setState({ isRevalidating: false });
  useOrderStore.setState({ isRevalidating: false });
  vi.useRealTimers();
});

describe('useIsSyncing', () => {
  it('is quiet when nothing is refreshing', () => {
    const { result } = renderHook(() => useIsSyncing());

    expect(result.current).toBe(false);
  });

  it('stays quiet for a refresh that finishes quickly', () => {
    // The common case: a domain event triggers a refetch that completes in tens
    // of milliseconds. Reporting that would make the chip flicker on every
    // change anywhere in the system.
    const { result } = renderHook(() => useIsSyncing());

    setRevalidating(() => useInventoryStore.setState({ isRevalidating: true }));
    act(() => {
      vi.advanceTimersByTime(SYNC_INDICATOR_DELAY_MS - 1);
    });
    expect(result.current).toBe(false);

    setRevalidating(() => useInventoryStore.setState({ isRevalidating: false }));
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe(false);
  });

  it('reports a refresh that is taking a noticeable amount of time', () => {
    const { result } = renderHook(() => useIsSyncing());

    setRevalidating(() => useInventoryStore.setState({ isRevalidating: true }));
    act(() => {
      vi.advanceTimersByTime(SYNC_INDICATOR_DELAY_MS);
    });

    expect(result.current).toBe(true);
  });

  it('clears once the refresh finishes', () => {
    const { result } = renderHook(() => useIsSyncing());

    setRevalidating(() => useInventoryStore.setState({ isRevalidating: true }));
    act(() => {
      vi.advanceTimersByTime(SYNC_INDICATOR_DELAY_MS);
    });
    expect(result.current).toBe(true);

    setRevalidating(() => useInventoryStore.setState({ isRevalidating: false }));

    expect(result.current).toBe(false);
  });

  it('notices a refresh in any collection, not just one', () => {
    // The indicator must not be wired to a single store, or a slow refresh of
    // orders would go unreported while inventory's showed up.
    const { result } = renderHook(() => useIsSyncing());

    setRevalidating(() => useOrderStore.setState({ isRevalidating: true }));
    act(() => {
      vi.advanceTimersByTime(SYNC_INDICATOR_DELAY_MS);
    });

    expect(result.current).toBe(true);
  });

  it('stays quiet when a short refresh is immediately followed by another', () => {
    // Back-to-back quick refreshes must not accumulate into a false positive.
    const { result } = renderHook(() => useIsSyncing());

    for (let i = 0; i < 5; i += 1) {
      setRevalidating(() => useInventoryStore.setState({ isRevalidating: true }));
      act(() => {
        vi.advanceTimersByTime(SYNC_INDICATOR_DELAY_MS - 50);
      });
      setRevalidating(() => useInventoryStore.setState({ isRevalidating: false }));
    }

    expect(result.current).toBe(false);
  });
});
