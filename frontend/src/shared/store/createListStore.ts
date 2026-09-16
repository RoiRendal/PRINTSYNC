import { create } from 'zustand';
import type { PaginatedResponse } from '@printsync/shared-types';
import { ApiError } from '../api/errors';

/**
 * Pagination defaults for client-side stores.
 *
 * These mirror `DEFAULT_PAGE` / `DEFAULT_LIMIT` in `@printsync/shared-types`.
 * They are duplicated (instead of imported) because the shared-types package is
 * consumed as **types only** — it has no Vite alias, so a value import would
 * fail to resolve at build time. Keep the two definitions in sync.
 */
export const FIRST_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;

/**
 * How long a fetched page is considered authoritative before a revalidation
 * trigger (window focus, a domain event, the background interval) is allowed to
 * refetch it.
 *
 * This is what stops "refresh on every focus" from turning into a request storm
 * when a cashier alt-tabs between the POS screen and the receipt printer. Short
 * enough that data feels live, long enough that repeated triggers collapse.
 */
export const DEFAULT_STALE_TIME_MS = 15_000;

/**
 * How long an optimistic patch may stand in for server data before it is dropped.
 *
 * A safety valve rather than a feature. If a mutation never settles — a promise
 * that neither resolves nor rejects — the overlay would otherwise keep showing a
 * value the server never accepted, for the rest of the session, with nothing on
 * screen to say the number is a guess. Ten seconds is comfortably longer than any
 * write this app performs.
 */
export const OPTIMISTIC_TTL_MS = 10_000;

export interface ListQuery {
  page?: number;
  limit?: number;
}

/** Minimum contract every entity managed by a list store must satisfy. */
export interface Identifiable {
  id: string;
}

export interface PaginatedListState<TItem> {
  items: TItem[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  /** `true` while a *background* refresh runs — never used to blank the view. */
  isRevalidating: boolean;
  error: string | null;
  /** `true` once the first successful (or failed) load has completed. */
  hasLoaded: boolean;
  /** Epoch ms of the last successful fetch; `null` means "known stale". */
  lastFetchedAt: number | null;
}

export interface PaginatedListActions<TItem> {
  /** Fetch a page with the blocking loading state. Persists `page`/`limit`. */
  fetchList: (query?: ListQuery) => Promise<void>;
  /** Fetch only when the store has no data yet — safe to call from many components. */
  ensureLoaded: () => Promise<void>;
  /** Re-fetch the page that is currently selected, showing the loading state. */
  refresh: () => Promise<void>;
  /**
   * Bring the current page up to date **only if it is stale**, and without ever
   * showing the loading state. This is the entry point every automatic trigger
   * (focus, domain event, interval) goes through, so it must be safe to call
   * frequently and safe to call for a store the user has never opened.
   */
  revalidate: () => Promise<void>;
  /**
   * Refreshes **regardless of `staleTime`**, still without showing the loading
   * state.
   *
   * Reserved for authoritative signals — a mutation this app performed, or a
   * server push saying "this domain changed". Those are not guesses: the data
   * really is different, so a 15-second freshness window must not swallow them.
   * The time-based triggers (focus, visibility, the fallback poll) deliberately
   * keep using plain `revalidate()` so they cannot storm.
   */
  forceRevalidate: () => Promise<void>;
  /** `true` when the cached page should be refetched before being trusted. */
  isStale: () => boolean;
  /** Marks the cache stale so the next `revalidate()` refetches. */
  invalidate: () => void;
  goToPage: (page: number) => Promise<void>;
  setListError: (error: string | null) => void;
  mutateItems: (updater: (items: TItem[]) => TItem[]) => void;
  replaceItem: (id: string, item: TItem) => void;
  prependItem: (item: TItem) => void;
  removeItem: (id: string) => void;
  /**
   * Show `changes` for `id` immediately, before the server has answered.
   *
   * See `optimisticUpdate` in the factory for why the overlay exists rather than
   * a fresh timestamp.
   */
  optimisticUpdate: (id: string, changes: Partial<TItem>) => void;
  /** Replaces the optimistic entry with the server's authoritative item. */
  commitOptimistic: (id: string, item: TItem) => void;
  /** Drops the optimistic entry and restores what was on screen before it. */
  rollbackOptimistic: (id: string) => void;
  resetList: () => void;
}

export type PaginatedListStore<TItem> = PaginatedListState<TItem> & PaginatedListActions<TItem>;

/**
 * Helpers handed to the domain-specific `actions` builder so feature stores can
 * read and mutate the list slice without depending on zustand internals.
 */
export interface ListStoreContext<TItem extends Identifiable> {
  /** Apply a partial update to the list slice. */
  patch: (partial: Partial<PaginatedListState<TItem>>) => void;
  /** Read the current list slice (including its actions). */
  snapshot: () => PaginatedListStore<TItem>;
  /** Re-fetch the current page. */
  refresh: () => Promise<void>;
  /** Optimistically update the cached collection. */
  mutateItems: (updater: (items: TItem[]) => TItem[]) => void;
  /** Surface (or clear) a user-facing error message. */
  setError: (error: string | null) => void;
  /** Map an unknown rejection to a readable message using the store's fallback. */
  toMessage: (error: unknown) => string;
  /** Show a change immediately, before the server has confirmed it. */
  optimisticUpdate: (id: string, changes: Partial<TItem>) => void;
  /** Replace the optimistic entry with the server's authoritative item. */
  commitOptimistic: (id: string, item: TItem) => void;
  /** Drop the optimistic entry and restore what was on screen before it. */
  rollbackOptimistic: (id: string) => void;
}

export interface CreateListStoreOptions<TItem extends Identifiable, TExtra> {
  /** Calls the feature API module. Must return a paginated envelope. */
  list: (query: ListQuery) => Promise<PaginatedResponse<TItem>>;
  /** Message shown when the API rejects without a usable message. */
  fallbackErrorMessage: string;
  defaultLimit?: number;
  /** Overrides `DEFAULT_STALE_TIME_MS` for stores that change very rapidly. */
  staleTime?: number;
  /** Domain-specific actions layered on top of the generic list behaviour. */
  actions?: (context: ListStoreContext<TItem>) => TExtra;
}

/**
 * Builds a zustand store for a paginated server-side collection.
 *
 * Every data store in the app (orders, inventory, customers, designs, users)
 * shares this shape, which keeps pagination, error handling and cache updates
 * consistent and removes the per-feature `useEffect` fetch boilerplate that
 * React Context required.
 *
 * ### Freshness model
 *
 * The store tracks `lastFetchedAt`. Any successful fetch — including the
 * response a mutation just returned — stamps it. `revalidate()` consults it and
 * does nothing while the page is still fresh, which is what makes it safe to
 * call `revalidate()` from a focus handler, a domain event, and a background
 * interval simultaneously.
 *
 * A *failed* background refresh deliberately keeps the last good snapshot on
 * screen and leaves `lastFetchedAt` untouched, so the next trigger retries.
 * Blanking a cashier's product grid because one poll timed out would be worse
 * than showing data that is a few seconds old.
 *
 * ### Optimistic writes
 *
 * `optimisticUpdate` / `commitOptimistic` / `rollbackOptimistic` let a mutation
 * show its result before the server answers. The overlay they maintain is applied
 * inside `runFetch`, and that is the whole point: a mutation emits a domain event,
 * the event reaches `forceRevalidate()`, and the refetch it starts would otherwise
 * overwrite the very change the user just made. Stamping `lastFetchedAt` cannot
 * prevent that, because `forceRevalidate()` skips the staleness check by design.
 */
export function createListStore<TItem extends Identifiable, TExtra extends object = Record<string, never>>(
  options: CreateListStoreOptions<TItem, TExtra>,
) {
  const defaultLimit = options.defaultLimit ?? DEFAULT_PAGE_SIZE;
  const staleTime = options.staleTime ?? DEFAULT_STALE_TIME_MS;
  /** Guards against out-of-order responses when pages are changed quickly. */
  let latestRequestId = 0;

  /**
   * Pending optimistic patches, keyed by item id. One map per store, shared by
   * every action the store exposes.
   *
   * `previous` is kept so a rollback can put back what was actually on screen.
   * Without it a rollback could only delete the overlay, and the optimistic value
   * — already written into `items` — would stay there.
   */
  const optimistic = new Map<string, { changes: Partial<TItem>; previous: TItem; expiresAt: number }>();

  /**
   * Re-applies pending patches over freshly fetched rows, and drops expired ones.
   *
   * This is what makes an optimistic write survive a refetch. `now` is read once
   * so every entry in a single pass is judged against the same instant.
   */
  const applyOptimistic = (items: TItem[]): TItem[] => {
    if (optimistic.size === 0) return items;
    const now = Date.now();
    return items.map((item) => {
      const entry = optimistic.get(item.id);
      if (!entry) return item;
      if (entry.expiresAt <= now) {
        optimistic.delete(item.id);
        return item;
      }
      return { ...item, ...entry.changes } as TItem;
    });
  };

  return create<PaginatedListStore<TItem> & TExtra>()((set, get) => {
    /*
     * The store is typed as `PaginatedListStore<TItem> & TExtra`, but the
     * generic `TExtra` is unresolved in here, so TypeScript cannot prove that a
     * partial of the list slice is a valid store patch. The slice only ever
     * writes to its own fields, so narrowing `set` once (with a documented
     * cast) keeps the rest of the factory fully type-safe.
     */
    const patch = set as unknown as (
      partial:
        | Partial<PaginatedListState<TItem>>
        | ((state: PaginatedListState<TItem>) => Partial<PaginatedListState<TItem>>),
    ) => void;
    const snapshot = (): PaginatedListStore<TItem> => get();
    const toMessage = (error: unknown) =>
      error instanceof ApiError ? error.message : options.fallbackErrorMessage;

    /**
     * @param mode `'blocking'` drives the page-level spinner and surfaces
     *             failures as an error state; `'silent'` refreshes underneath
     *             the rendered data and swallows failures.
     */
    const runFetch = async (query: ListQuery | undefined, mode: 'blocking' | 'silent') => {
      const { page, limit } = get();
      const nextPage = Math.max(FIRST_PAGE, query?.page ?? page);
      const nextLimit = query?.limit ?? limit;
      const requestId = ++latestRequestId;

      if (mode === 'silent') {
        patch({ isRevalidating: true });
      } else {
        patch({ isLoading: true, page: nextPage, limit: nextLimit });
      }

      try {
        const response = await options.list({ page: nextPage, limit: nextLimit });
        if (requestId !== latestRequestId) return;
        patch({
          items: applyOptimistic(response.data),
          total: response.total,
          page: response.page || nextPage,
          limit: response.limit || nextLimit,
          error: null,
          hasLoaded: true,
          isLoading: false,
          isRevalidating: false,
          lastFetchedAt: Date.now(),
        });
      } catch (error: unknown) {
        if (requestId !== latestRequestId) return;
        if (mode === 'silent') {
          patch({ isRevalidating: false });
          return;
        }
        patch({ isLoading: false, hasLoaded: true, error: toMessage(error) });
      }
    };

    /**
     * Every local mutation calls this: the mutation's own response *is* fresh
     * server data, so the cache is authoritative as of now, and the time-based
     * triggers (focus, visibility, the fallback poll) should not refetch a page
     * the app just updated.
     *
     * It does **not** hold off a domain event. Since the realtime work those go
     * through `forceRevalidate()`, which skips the staleness check by design — so
     * a mutation's own event does refetch the page it just wrote. That is exactly
     * why an optimistic write needs the overlay above: stamping the cache cannot
     * protect a value from a refetch that ignores the stamp.
     *
     * A function rather than a constant — the store factory runs once, so a
     * captured `Date.now()` would freeze the timestamp at store-creation time
     * and every mutation would look permanently fresh.
     */
    const markFresh = () => ({ lastFetchedAt: Date.now() });

    /**
     * Shared body of `revalidate()` and `forceRevalidate()`.
     *
     * @param force skip the `staleTime` check. See `forceRevalidate` for when
     *              that is the correct choice.
     */
    const revalidateInternal = async (force: boolean) => {
      const { hasLoaded, isLoading } = get();
      // A fetch is already in flight; letting a second one start would race
      // and could resolve out of order.
      if (isLoading) return;
      if (!hasLoaded) {
        // Never opened by this user — do not fetch it on their behalf.
        // `loadDataStores()` decides what gets primed; this keeps a staff
        // account from tripping a 403 on the admin-only users endpoint.
        return;
      }
      if (!force && !get().isStale()) return;
      await runFetch(undefined, 'silent');
    };

    const listActions: PaginatedListActions<TItem> = {
      fetchList: (query) => runFetch(query, 'blocking'),

      ensureLoaded: async () => {
        const { hasLoaded, isLoading } = get();
        if (hasLoaded || isLoading) return;
        await get().fetchList();
      },

      refresh: () => runFetch(undefined, 'blocking'),

      revalidate: () => revalidateInternal(false),

      forceRevalidate: () => revalidateInternal(true),

      isStale: () => {
        const { lastFetchedAt, hasLoaded } = get();
        if (!hasLoaded || lastFetchedAt === null) return true;
        return Date.now() - lastFetchedAt >= staleTime;
      },

      invalidate: () => patch({ lastFetchedAt: null }),

      goToPage: (page) => runFetch({ page }, 'blocking'),

      setListError: (error) => patch({ error }),

      mutateItems: (updater) =>
        patch((state) => ({ items: updater(state.items), ...markFresh() })),

      replaceItem: (id, item) =>
        patch((state) => ({
          items: state.items.map((current) => (current.id === id ? item : current)),
          ...markFresh(),
        })),

      prependItem: (item) =>
        patch((state) => ({ items: [item, ...state.items], total: state.total + 1, ...markFresh() })),

      removeItem: (id) =>
        patch((state) => ({
          items: state.items.filter((current) => current.id !== id),
          total: Math.max(0, state.total - 1),
          ...markFresh(),
        })),

      optimisticUpdate: (id, changes) => {
        /*
         * `undefined` values are dropped rather than spread. A caller passing
         * `Partial<T>` from a form can easily carry an explicit `undefined` for a
         * field it is not editing, and spreading that would blank a real value on
         * screen — an optimistic write must only ever add information.
         */
        const defined = Object.fromEntries(
          Object.entries(changes).filter(([, value]) => value !== undefined),
        ) as Partial<TItem>;
        if (Object.keys(defined).length === 0) return;

        const previous = get().items.find((item) => item.id === id);
        if (!previous) return;

        optimistic.set(id, { changes: defined, previous, expiresAt: Date.now() + OPTIMISTIC_TTL_MS });
        patch((state) => ({
          items: state.items.map((item) => (item.id === id ? ({ ...item, ...defined } as TItem) : item)),
        }));
      },

      commitOptimistic: (id, item) => {
        optimistic.delete(id);
        patch((state) => ({
          items: state.items.map((current) => (current.id === id ? item : current)),
          ...markFresh(),
        }));
      },

      rollbackOptimistic: (id) => {
        const entry = optimistic.get(id);
        optimistic.delete(id);
        if (!entry) return;
        patch((state) => ({
          items: state.items.map((current) => (current.id === id ? entry.previous : current)),
          /*
           * The restored value is a memory of what was on screen, not a claim
           * about the server. Marking the cache stale means the next revalidation
           * trigger replaces it with the truth even if the caller never asks for a
           * refresh — which matters, because the reason for the rollback was that
           * the server disagreed.
           */
          lastFetchedAt: null,
        }));
      },

      resetList: () => {
        optimistic.clear();
        patch({
          items: [],
          total: 0,
          page: FIRST_PAGE,
          limit: defaultLimit,
          isLoading: false,
          isRevalidating: false,
          error: null,
          hasLoaded: false,
          lastFetchedAt: null,
        });
      },
    };

    const extra = options.actions
      ? options.actions({
          patch,
          snapshot,
          refresh: () => get().fetchList(),
          mutateItems: listActions.mutateItems,
          setError: listActions.setListError,
          toMessage,
          optimisticUpdate: listActions.optimisticUpdate,
          commitOptimistic: listActions.commitOptimistic,
          rollbackOptimistic: listActions.rollbackOptimistic,
        })
      : ({} as TExtra);

    return {
      items: [],
      total: 0,
      page: FIRST_PAGE,
      limit: defaultLimit,
      isLoading: false,
      isRevalidating: false,
      error: null,
      hasLoaded: false,
      lastFetchedAt: null,
      ...listActions,
      ...extra,
    };
  });
}
