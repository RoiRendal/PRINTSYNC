import { useCallback, useEffect, useRef, useState } from 'react';
import { dashboardApi } from '../api/dashboardApi';
import type { OrdersSummary } from '../../orders/types';
import { ApiError } from '../../../shared/api/errors';
import {
  includesAnyDomain,
  subscribeToDataChanges,
  type DataDomain,
} from '../../../shared/store/dataEvents';

/**
 * Domains that can move a number on the Workspace.
 *
 * Exactly two, and both are needed:
 *
 *   - `orders` — every status count, and `open`.
 *   - `inventory` — `lowStock`. A POS sale decrements stock and creates an order,
 *     announcing both at once, so leaving inventory out would leave the Low stock
 *     card stale after the very action most likely to change it.
 *
 * `payments` is deliberately absent: a payment moves a balance, not a status, and
 * the Workspace shows no money figure.
 */
const SUMMARY_DOMAINS: readonly DataDomain[] = ['orders', 'inventory'];

/**
 * One user action can announce several domains at once (a POS sale touches orders
 * *and* inventory). Coalescing them into a single reload keeps one action from
 * firing two parallel requests for the same payload.
 */
const RELOAD_DEBOUNCE_MS = 400;

export interface OrdersSummaryState {
  /** `null` until the first successful read. */
  summary: OrdersSummary | null;
  /** The last failure, kept even while stale counts are still on screen. */
  error: string | null;
  /** True only while there is nothing to show — never during a background reload. */
  isLoading: boolean;
  /** Re-reads the summary and shows the loading state while it does. */
  refresh: () => void;
}

/**
 * Reads the Workspace counts once, then keeps them current.
 *
 * This is the codebase's first single-object data source: there is no store for a
 * non-list payload, and the Analytics page solved the same problem the same way —
 * a small dedicated hook. The list stores are the wrong shape here (they carry
 * paging and items), and a store for one object would add a cache with no second
 * reader.
 *
 * ### It never blanks what is already on screen
 *
 * A background reload replaces the numbers when it lands; it does not clear them
 * first. That is the rule the list stores follow, and the reason the revalidation
 * layer is safe to fire from several places at once — and it matters more here,
 * because this is the page staff land on. A failure keeps the stale counts visible
 * *and* sets `error`, so the page can say the numbers may be out of date rather
 * than replacing a good screen with an error.
 *
 * ### No fallback
 *
 * If the request fails there is no second implementation to fall back to. See the
 * note in `dashboardApi.ts`.
 */
export function useOrdersSummary(): OrdersSummaryState {
  const [summary, setSummary] = useState<OrdersSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const reloadTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const cancelPendingReload = () => {
      if (reloadTimerRef.current !== null) {
        window.clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = null;
      }
    };

    const unsubscribe = subscribeToDataChanges((domains) => {
      if (!includesAnyDomain(domains, SUMMARY_DOMAINS)) return;
      cancelPendingReload();
      reloadTimerRef.current = window.setTimeout(() => {
        reloadTimerRef.current = null;
        setReloadToken((token) => token + 1);
      }, RELOAD_DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      cancelPendingReload();
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    void dashboardApi
      .summary()
      .then((next) => {
        if (!mounted) return;
        setSummary(next);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!mounted) return;
        setError(
          cause instanceof ApiError ? cause.message : 'The workspace counts could not be loaded.',
        );
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [reloadToken]);

  /*
   * The user-facing retry, and the one path that *does* show a loading state. A
   * background reload does not, so a live-updating page never flickers back to a
   * placeholder — but pressing Retry after an error should visibly do something.
   */
  const refresh = useCallback(() => {
    setIsLoading(true);
    setReloadToken((token) => token + 1);
  }, []);

  return { summary, error, isLoading, refresh };
}
