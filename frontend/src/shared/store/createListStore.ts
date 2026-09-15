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
  error: string | null;
  /** `true` once the first successful (or failed) load has completed. */
  hasLoaded: boolean;
}

export interface PaginatedListActions<TItem> {
  /** Fetch a page. Persists `page`/`limit` so `refresh()` can re-use them. */
  fetchList: (query?: ListQuery) => Promise<void>;
  /** Fetch only when the store has no data yet — safe to call from many components. */
  ensureLoaded: () => Promise<void>;
  /** Re-fetch the page that is currently selected. */
  refresh: () => Promise<void>;
  goToPage: (page: number) => Promise<void>;
  setListError: (error: string | null) => void;
  mutateItems: (updater: (items: TItem[]) => TItem[]) => void;
  replaceItem: (id: string, item: TItem) => void;
  prependItem: (item: TItem) => void;
  removeItem: (id: string) => void;
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
}

export interface CreateListStoreOptions<TItem extends Identifiable, TExtra> {
  /** Calls the feature API module. Must return a paginated envelope. */
  list: (query: ListQuery) => Promise<PaginatedResponse<TItem>>;
  /** Message shown when the API rejects without a usable message. */
  fallbackErrorMessage: string;
  defaultLimit?: number;
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
 */
export function createListStore<TItem extends Identifiable, TExtra extends object = Record<string, never>>(
  options: CreateListStoreOptions<TItem, TExtra>,
) {
  const defaultLimit = options.defaultLimit ?? DEFAULT_PAGE_SIZE;
  /** Guards against out-of-order responses when pages are changed quickly. */
  let latestRequestId = 0;

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

    const listActions: PaginatedListActions<TItem> = {
      fetchList: async (query) => {
        const { page, limit } = get();
        const nextPage = Math.max(FIRST_PAGE, query?.page ?? page);
        const nextLimit = query?.limit ?? limit;
        const requestId = ++latestRequestId;

        patch({ isLoading: true, page: nextPage, limit: nextLimit });

        try {
          const response = await options.list({ page: nextPage, limit: nextLimit });
          if (requestId !== latestRequestId) return;
          patch({
            items: response.data,
            total: response.total,
            page: response.page || nextPage,
            limit: response.limit || nextLimit,
            error: null,
            hasLoaded: true,
            isLoading: false,
          });
        } catch (error: unknown) {
          if (requestId !== latestRequestId) return;
          patch({ isLoading: false, hasLoaded: true, error: toMessage(error) });
        }
      },

      ensureLoaded: async () => {
        const { hasLoaded, isLoading } = get();
        if (hasLoaded || isLoading) return;
        await get().fetchList();
      },

      refresh: async () => {
        await get().fetchList();
      },

      goToPage: async (page) => {
        await get().fetchList({ page });
      },

      setListError: (error) => patch({ error }),

      mutateItems: (updater) => patch((state) => ({ items: updater(state.items) })),

      replaceItem: (id, item) =>
        patch((state) => ({
          items: state.items.map((current) => (current.id === id ? item : current)),
        })),

      prependItem: (item) => patch((state) => ({ items: [item, ...state.items] })),

      removeItem: (id) =>
        patch((state) => ({ items: state.items.filter((current) => current.id !== id) })),

      resetList: () =>
        patch({
          items: [],
          total: 0,
          page: FIRST_PAGE,
          limit: defaultLimit,
          isLoading: false,
          error: null,
          hasLoaded: false,
        }),
    };

    const extra = options.actions
      ? options.actions({
          patch,
          snapshot,
          refresh: () => get().fetchList(),
          mutateItems: listActions.mutateItems,
          setError: listActions.setListError,
          toMessage,
        })
      : ({} as TExtra);

    return {
      items: [],
      total: 0,
      page: FIRST_PAGE,
      limit: defaultLimit,
      isLoading: false,
      error: null,
      hasLoaded: false,
      ...listActions,
      ...extra,
    };
  });
}
