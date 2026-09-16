import { useEffect } from 'react';
import { subscribeToDataChanges } from '../../shared/store/dataEvents';
import { revalidateAllDataStores, revalidateDataDomains } from '../stores';

/**
 * How long a workstation must stay blurred before returning to the tab is
 * allowed to trigger a refresh. Without it, alt-tabbing between the POS screen
 * and a receipt printer would fire a refetch every few seconds.
 *
 * The stores also enforce their own `staleTime`, so this is a second guard
 * rather than the primary one.
 */
const FOCUS_COOLDOWN_MS = 5_000;

/**
 * Safety-net poll interval.
 *
 * PRINTSYNC has no server-push channel yet, so a change made by another staff
 * member is only discovered when this client asks. Focus and visibility
 * revalidation already cover the common "cashier comes back to the screen"
 * case; this interval covers the rarer one where a screen is left open and
 * unattended on the shop floor.
 *
 * It is intentionally slow — 4 requests per minute per signed-in workstation.
 * When the server-sent-events channel described in
 * `docs/DATA-SYNC-IMPLEMENTATION-PLAN.md` (Tier 2) lands, set this to `0` to
 * disable polling entirely.
 */
const BACKGROUND_POLL_MS = 60_000;

/**
 * Central revalidation driver.
 *
 * Mounted once, inside the authenticated shell. It turns the three signals that
 * mean "our cached data may be out of date" into store refreshes:
 *
 *   1. **Domain events** — something was mutated in this tab. Stores that are
 *      not the originator of the change refetch; the originator already stamped
 *      its cache as fresh from the mutation response.
 *   2. **Returning to the tab** — focus / visibility / regaining connectivity.
 *   3. **The background poll** — the interim answer for cross-workstation
 *      freshness until the realtime channel exists.
 *
 * Every path funnels into `revalidate()`, which no-ops while the cache is fresh
 * and never blanks the rendered data. That is what makes it safe to have all
 * three fire at once.
 *
 * @param isActive `false` while signed out, so a login screen never polls.
 */
export function useDataRevalidation(isActive: boolean): void {
  useEffect(() => {
    if (!isActive) return;

    let lastFocusRevalidateAt = 0;

    const revalidateIfVisible = (force = false) => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (!force && now - lastFocusRevalidateAt < FOCUS_COOLDOWN_MS) return;
      lastFocusRevalidateAt = now;
      revalidateAllDataStores();
    };

    const handleFocus = () => revalidateIfVisible();
    const handleOnline = () => revalidateIfVisible(true);
    const handleVisibilityChange = () => revalidateIfVisible();

    // A change announced anywhere in the app — including from a POS sale that
    // writes a payment, decrements stock, and moves revenue simultaneously.
    const unsubscribe = subscribeToDataChanges((domains) => revalidateDataDomains(domains));

    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const pollId = window.setInterval(() => {
      if (BACKGROUND_POLL_MS > 0) revalidateIfVisible();
    }, BACKGROUND_POLL_MS);

    return () => {
      unsubscribe();
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(pollId);
    };
  }, [isActive]);
}
