// @vitest-environment node
/**
 * The freshness model is the load-bearing part of the live-data work, and the
 * part with no natural way to notice it broke: every failure mode here is
 * "the screen quietly shows something a few seconds out of date", which nobody
 * reports as a bug and no build step catches.
 *
 * The rules under test, in one place:
 *
 *   - `revalidate()` respects `staleTime` and is therefore safe to call from
 *     focus, visibility, connectivity and the fallback poll simultaneously.
 *   - `forceRevalidate()` ignores `staleTime`, and is what an authoritative
 *     signal — a committed mutation, or a server push — must use. Using the
 *     wrong one of these two is the single most likely future regression.
 *   - A *failed* background refresh keeps the last good data on screen and
 *     leaves `lastFetchedAt` alone, so the next trigger tries again. Blanking a
 *     cashier's product grid over one timed-out poll would be worse than
 *     showing data a few seconds old.
 *   - A store the user has never opened is never fetched on their behalf, which
 *     is what stops a staff account tripping a 403 on the admin-only users
 *     endpoint.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PaginatedResponse } from '@printsync/shared-types';
import { ApiError } from '../api/errors';
import { createListStore, DEFAULT_STALE_TIME_MS, type ListQuery } from './createListStore';

interface Widget {
  id: string;
  name: string;
}

const widget = (name: string): Widget => ({ id: `id-${name}`, name });

function page(items: Widget[], total = items.length, pageNumber = 1, limit = 20): PaginatedResponse<Widget> {
  return { data: items, total, page: pageNumber, limit };
}

type ListFn = (query: ListQuery) => Promise<PaginatedResponse<Widget>>;

function setup(overrides: { staleTime?: number; initial?: Widget[] } = {}) {
  const list = vi.fn<ListFn>(async () => page(overrides.initial ?? [widget('alpha')]));
  const store = createListStore<Widget>({
    list,
    fallbackErrorMessage: 'Widgets could not be loaded.',
    ...(overrides.staleTime === undefined ? {} : { staleTime: overrides.staleTime }),
  });
  return { list, store };
}

/** A promise whose settlement this test controls, for ordering races. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('createListStore — freshness', () => {
  it('does not refetch while the cached page is still fresh', async () => {
    vi.useFakeTimers();
    const { list, store } = setup();

    await store.getState().fetchList();
    await store.getState().revalidate();
    await store.getState().revalidate();

    expect(list).toHaveBeenCalledTimes(1);
  });

  it('refetches once the staleTime window has passed', async () => {
    vi.useFakeTimers();
    const { list, store } = setup();

    await store.getState().fetchList();
    vi.advanceTimersByTime(DEFAULT_STALE_TIME_MS + 1);
    await store.getState().revalidate();

    expect(list).toHaveBeenCalledTimes(2);
  });

  it('forceRevalidate bypasses the staleTime window entirely', async () => {
    // This is the rule that keeps the push channel honest. A domain event is
    // emitted only after a write committed, so it is not a guess — and letting a
    // 15-second freshness window swallow it would leave the cashier looking at
    // stock that is already wrong.
    vi.useFakeTimers();
    const { list, store } = setup();

    await store.getState().fetchList();
    await store.getState().forceRevalidate();

    expect(list).toHaveBeenCalledTimes(2);
  });

  it('treats a store with no successful fetch as stale', () => {
    const { store } = setup();
    expect(store.getState().isStale()).toBe(true);
    expect(store.getState().hasLoaded).toBe(false);
  });

  it('invalidate() makes the next revalidate() refetch', async () => {
    vi.useFakeTimers();
    const { list, store } = setup();

    await store.getState().fetchList();
    store.getState().invalidate();
    await store.getState().revalidate();

    expect(list).toHaveBeenCalledTimes(2);
  });
});

describe('createListStore — never fetch what the user has not opened', () => {
  it('revalidate() is a no-op before the first load', async () => {
    const { list, store } = setup();

    await store.getState().revalidate();
    await store.getState().forceRevalidate();

    // Even the forced path stays put. `loadDataStores()` decides what gets
    // primed; a background trigger must not make that decision instead.
    expect(list).not.toHaveBeenCalled();
  });

  it('revalidate() does not race an in-flight blocking fetch', async () => {
    const pending = deferred<PaginatedResponse<Widget>>();
    const list = vi.fn<ListFn>().mockReturnValueOnce(pending.promise);
    const store = createListStore<Widget>({ list, fallbackErrorMessage: 'x' });

    const inFlight = store.getState().fetchList();
    await store.getState().revalidate();

    expect(list).toHaveBeenCalledTimes(1);
    pending.resolve(page([widget('alpha')]));
    await inFlight;
  });

  it('ensureLoaded() only fetches once', async () => {
    const { list, store } = setup();

    await store.getState().ensureLoaded();
    await store.getState().ensureLoaded();

    expect(list).toHaveBeenCalledTimes(1);
  });
});

describe('createListStore — failure handling', () => {
  it('a failed background refresh keeps the last good data and stays stale', async () => {
    vi.useFakeTimers();
    const { list, store } = setup({ initial: [widget('alpha')] });

    await store.getState().fetchList();
    const fetchedAt = store.getState().lastFetchedAt;

    list.mockRejectedValueOnce(new ApiError('Network unreachable', 503));
    vi.advanceTimersByTime(DEFAULT_STALE_TIME_MS + 1);
    await store.getState().revalidate();

    // The cashier keeps their grid, and the failure is not painted as an error
    // banner over data that is still perfectly usable.
    expect(store.getState().items.map((item) => item.name)).toEqual(['alpha']);
    expect(store.getState().error).toBeNull();
    // Leaving the timestamp alone is what makes the next trigger retry rather
    // than wait out a freshness window that was never earned.
    expect(store.getState().lastFetchedAt).toBe(fetchedAt);
    expect(store.getState().isStale()).toBe(true);
    expect(store.getState().isRevalidating).toBe(false);
  });

  it('a failed blocking fetch surfaces the error and stops loading', async () => {
    const list = vi.fn<ListFn>().mockRejectedValue(new ApiError('Widgets are down', 500));
    const store = createListStore<Widget>({ list, fallbackErrorMessage: 'fallback' });

    await store.getState().fetchList();

    expect(store.getState().error).toBe('Widgets are down');
    expect(store.getState().isLoading).toBe(false);
    expect(store.getState().hasLoaded).toBe(true);
  });

  it('falls back to the store message for a non-API failure', async () => {
    const list = vi.fn<ListFn>().mockRejectedValue(new TypeError('fetch failed'));
    const store = createListStore<Widget>({ list, fallbackErrorMessage: 'Widgets could not be loaded.' });

    await store.getState().fetchList();

    expect(store.getState().error).toBe('Widgets could not be loaded.');
  });
});

describe('createListStore — response ordering', () => {
  it('discards a slow response that a newer request has superseded', async () => {
    const older = deferred<PaginatedResponse<Widget>>();
    const newer = deferred<PaginatedResponse<Widget>>();
    const list = vi.fn<ListFn>().mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    const store = createListStore<Widget>({ list, fallbackErrorMessage: 'x' });

    const first = store.getState().fetchList({ page: 1 });
    const second = store.getState().fetchList({ page: 2 });

    // Page 2 lands first; page 1 then arrives late and must not win.
    newer.resolve(page([widget('newer')], 1, 2));
    await second;
    older.resolve(page([widget('older')], 1, 1));
    await first;

    expect(store.getState().items.map((item) => item.name)).toEqual(['newer']);
    expect(store.getState().page).toBe(2);
  });
});

describe('createListStore — local cache updates', () => {
  it('a local mutation stamps freshness so its own event does not bounce back', async () => {
    vi.useFakeTimers();
    const { list, store } = setup();

    await store.getState().fetchList();
    vi.advanceTimersByTime(DEFAULT_STALE_TIME_MS + 1);
    store.getState().mutateItems((items) => [...items, widget('beta')]);
    await store.getState().revalidate();

    // The mutation's own response was fresh server data, so the domain event it
    // emitted must not trigger an immediate refetch of what it just wrote.
    expect(list).toHaveBeenCalledTimes(1);
    expect(store.getState().items.map((item) => item.name)).toEqual(['alpha', 'beta']);
  });

  it('prependItem and removeItem keep total in step', async () => {
    const { store } = setup();
    await store.getState().fetchList();

    store.getState().prependItem(widget('beta'));
    expect(store.getState().total).toBe(2);

    store.getState().removeItem('id-beta');
    expect(store.getState().total).toBe(1);
    expect(store.getState().items.map((item) => item.name)).toEqual(['alpha']);
  });

  it('removeItem never drives total below zero', () => {
    const { store } = setup();
    store.getState().removeItem('never-existed');
    expect(store.getState().total).toBe(0);
  });

  it('resetList clears data and freshness together', async () => {
    const { store } = setup();
    await store.getState().fetchList();

    store.getState().resetList();

    expect(store.getState().items).toEqual([]);
    expect(store.getState().hasLoaded).toBe(false);
    expect(store.getState().lastFetchedAt).toBeNull();
  });
});
