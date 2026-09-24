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
import { createListStore, DEFAULT_STALE_TIME_MS, OPTIMISTIC_TTL_MS, type ListQuery } from './createListStore';

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
  it('a local mutation stamps freshness, so time-based triggers leave it alone', async () => {
    vi.useFakeTimers();
    const { list, store } = setup();

    await store.getState().fetchList();
    vi.advanceTimersByTime(DEFAULT_STALE_TIME_MS + 1);
    store.getState().mutateItems((items) => [...items, widget('beta')]);
    await store.getState().revalidate();

    // The mutation's own response was fresh server data, so a focus or poll
    // trigger must not refetch what the app just wrote.
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

/**
 * Optimistic writes.
 *
 * The overlay exists for one specific race, and it is worth stating plainly
 * because the code looks like it could be simplified away:
 *
 *   1. a mutation writes its result to the cache and shows it;
 *   2. the same mutation emits a domain event;
 *   3. that event reaches `forceRevalidate()`, which **skips the staleness check
 *      by design** — so `markFresh()` cannot hold it off;
 *   4. the refetch returns the row as the server still has it, and would overwrite
 *      the change the user is looking at.
 *
 * The first test in this block is the one that fails if the overlay is removed.
 */
describe('createListStore — optimistic writes', () => {
  it('shows the change immediately, before the server has answered', async () => {
    const { store } = setup();
    await store.getState().fetchList();

    store.getState().optimisticUpdate('id-alpha', { name: 'alpha (edited)' });

    expect(store.getState().items[0]?.name).toBe('alpha (edited)');
  });

  it('survives a refetch that lands while the write is still in flight', async () => {
    const { store } = setup();
    await store.getState().fetchList();

    store.getState().optimisticUpdate('id-alpha', { name: 'alpha (edited)' });
    // Stands in for the mutation's own domain event: forced, so it ignores the
    // freshness stamp and returns the server's pre-edit row.
    await store.getState().forceRevalidate();

    expect(store.getState().items[0]?.name).toBe('alpha (edited)');
  });

  it('an ordinary mutation does NOT survive a forced revalidation', async () => {
    // The counterpart to the test above, and the reason the overlay is needed at
    // all: `mutateItems` only stamps `lastFetchedAt`, and `forceRevalidate()`
    // does not consult it.
    const { list, store } = setup();
    await store.getState().fetchList();

    store.getState().mutateItems((items) => items.map((item) => ({ ...item, name: 'local edit' })));
    await store.getState().forceRevalidate();

    expect(list).toHaveBeenCalledTimes(2);
    expect(store.getState().items[0]?.name).toBe('alpha');
  });

  it('commitOptimistic retires the overlay in favour of the server item', async () => {
    const { store } = setup();
    await store.getState().fetchList();

    store.getState().optimisticUpdate('id-alpha', { name: 'alpha (edited)' });
    store.getState().commitOptimistic('id-alpha', { id: 'id-alpha', name: 'alpha (saved)' });
    await store.getState().forceRevalidate();

    // Were the overlay still present, the fetched row would be overlaid with
    // "alpha (edited)" and this would read that instead.
    expect(store.getState().items[0]?.name).toBe('alpha');
  });

  it('rollbackOptimistic puts back what was on screen before the write', async () => {
    const { store } = setup();
    await store.getState().fetchList();

    store.getState().optimisticUpdate('id-alpha', { name: 'alpha (edited)' });
    store.getState().rollbackOptimistic('id-alpha');

    // Deleting the overlay alone would not be enough — the optimistic value is
    // already in `items`, which is why the previous row is remembered.
    expect(store.getState().items[0]?.name).toBe('alpha');
  });

  it('a rollback leaves the cache stale, so the truth is fetched next time', async () => {
    vi.useFakeTimers();
    const { list, store } = setup();
    await store.getState().fetchList();

    store.getState().optimisticUpdate('id-alpha', { name: 'alpha (edited)' });
    store.getState().rollbackOptimistic('id-alpha');
    await store.getState().revalidate();

    // The restored value is a memory of the screen, not a claim about the server,
    // and the reason for the rollback was that the server disagreed.
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('drops a patch that never settled instead of showing it forever', async () => {
    vi.useFakeTimers();
    const { store } = setup();
    await store.getState().fetchList();

    store.getState().optimisticUpdate('id-alpha', { name: 'alpha (edited)' });
    vi.advanceTimersByTime(OPTIMISTIC_TTL_MS + 1);
    await store.getState().forceRevalidate();

    expect(store.getState().items[0]?.name).toBe('alpha');
  });

  it('ignores a write for a row the store does not hold', () => {
    const { store } = setup();
    store.getState().optimisticUpdate('id-missing', { name: 'ghost' });
    expect(store.getState().items).toEqual([]);
  });

  it('never lets an undefined field blank a real value', async () => {
    const { store } = setup();
    await store.getState().fetchList();

    // A form's `Partial<T>` routinely carries an explicit `undefined` for fields
    // it is not editing, and spreading that would wipe the value on screen.
    store.getState().optimisticUpdate('id-alpha', { name: undefined });

    expect(store.getState().items[0]?.name).toBe('alpha');
  });

  it('resetList clears pending patches along with the data', async () => {
    const { store } = setup();
    await store.getState().fetchList();
    store.getState().optimisticUpdate('id-alpha', { name: 'alpha (edited)' });

    store.getState().resetList();
    await store.getState().fetchList();

    expect(store.getState().items[0]?.name).toBe('alpha');
  });
});

/**
 * Filters.
 *
 * A list store can carry one domain filter, which is what lets a deep link like
 * `/orders?status=Ready for Pickup` open a list that is *actually* narrowed.
 *
 * The rule under test, and the one most likely to rot: the filter is re-sent on
 * **every** fetch, not just the one the user triggered. `revalidate()`,
 * `refresh()` and `goToPage()` all refetch with pagination only, so a filter that
 * travelled on `fetchList` alone would survive exactly one interaction — and then
 * a focus, a poll or a page-turn would quietly refetch the whole table. That
 * failure looks like "the filter came off by itself", which is hard to attribute
 * and easy to ship. The third test below is the one that catches it.
 */
describe('createListStore — filters', () => {
  interface WidgetFilters {
    name?: string;
  }

  type FilteredListFn = (query: ListQuery<WidgetFilters>) => Promise<PaginatedResponse<Widget>>;

  /**
   * A store that carries a filter. The mock echoes the page it was asked for, so
   * a test can tell "refetched page 1" from "refetched the current page" — the
   * plain `setup()` always answers with page 1, which would hide that difference.
   */
  function setupFiltered() {
    const list = vi.fn<FilteredListFn>(async (query) =>
      page([widget('alpha')], 1, query.page ?? 1, query.limit ?? 20),
    );
    const store = createListStore<Widget, Record<string, never>, WidgetFilters>({
      list,
      fallbackErrorMessage: 'Widgets could not be loaded.',
    });
    return { list, store };
  }

  it('a store with no filter still sends pagination and nothing else', async () => {
    // The additive half of the change: widening the factory must not alter what a
    // store that filters nothing puts on the wire.
    const { list, store } = setup();

    await store.getState().fetchList();

    expect(list).toHaveBeenLastCalledWith({ page: 1, limit: 20 });
  });

  it('forwards the filter verbatim to the API, alongside pagination', async () => {
    const { list, store } = setupFiltered();

    await store.getState().setFilters({ name: 'alpha' });

    // Verbatim, not reshaped: the API module forwards the query object and the
    // client serialises it, so `name` has to arrive as a plain key.
    expect(list).toHaveBeenLastCalledWith({ name: 'alpha', page: 1, limit: 20 });
  });

  it('a filter change refetches from page 1, not the page the user was on', async () => {
    const { list, store } = setupFiltered();
    await store.getState().fetchList();
    await store.getState().goToPage(3);
    expect(store.getState().page).toBe(3);

    await store.getState().setFilters({ name: 'alpha' });

    // Applying a filter on page 3 would show an empty list for a filter that has
    // matches on page 1, and the pager would report the wrong page count.
    expect(list).toHaveBeenLastCalledWith({ name: 'alpha', page: 1, limit: 20 });
    expect(store.getState().page).toBe(1);
  });

  it('a background revalidation still asks for the filtered page', async () => {
    // The regression this whole design exists to prevent. `revalidate()` carries
    // no filter of its own, so if the filter were not held in state the request
    // below would come back unfiltered and silently widen the screen.
    vi.useFakeTimers();
    const { list, store } = setupFiltered();
    await store.getState().setFilters({ name: 'alpha' });
    list.mockClear();

    vi.advanceTimersByTime(DEFAULT_STALE_TIME_MS + 1);
    await store.getState().revalidate();

    expect(list).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenLastCalledWith({ name: 'alpha', page: 1, limit: 20 });
  });

  it('a forced revalidation — a domain event — keeps the filter too', async () => {
    const { list, store } = setupFiltered();
    await store.getState().setFilters({ name: 'alpha' });
    list.mockClear();

    await store.getState().forceRevalidate();

    expect(list).toHaveBeenLastCalledWith({ name: 'alpha', page: 1, limit: 20 });
  });

  it('paging keeps the filter', async () => {
    const { list, store } = setupFiltered();
    await store.getState().setFilters({ name: 'alpha' });
    list.mockClear();

    await store.getState().goToPage(2);

    expect(list).toHaveBeenLastCalledWith({ name: 'alpha', page: 2, limit: 20 });
  });

  it('setFilters works as the very first fetch, before the store has loaded', async () => {
    // The mount case a deep link hits: the page sets its filter from the URL
    // before anything has been fetched, and must not need a load first.
    const { list, store } = setupFiltered();
    expect(store.getState().hasLoaded).toBe(false);

    await store.getState().setFilters({ name: 'alpha' });

    expect(list).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenLastCalledWith({ name: 'alpha', page: 1, limit: 20 });
    expect(store.getState().hasLoaded).toBe(true);
  });

  it('setFilters({}) clears the filter', async () => {
    const { list, store } = setupFiltered();
    await store.getState().setFilters({ name: 'alpha' });

    await store.getState().setFilters({});

    // Replaced, not merged — an empty object has to mean "everything".
    expect(list).toHaveBeenLastCalledWith({ page: 1, limit: 20 });
  });

  it('resetList clears the filter along with the data', async () => {
    const { list, store } = setupFiltered();
    await store.getState().setFilters({ name: 'alpha' });

    store.getState().resetList();
    await store.getState().fetchList();

    expect(list).toHaveBeenLastCalledWith({ page: 1, limit: 20 });
  });

  it('a filter named on the query wins over the stored one', async () => {
    const { list, store } = setupFiltered();
    await store.getState().setFilters({ name: 'alpha' });

    await store.getState().fetchList({ name: 'beta' });

    expect(list).toHaveBeenLastCalledWith({ name: 'beta', page: 1, limit: 20 });
  });
});
