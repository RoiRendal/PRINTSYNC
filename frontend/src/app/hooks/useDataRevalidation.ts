import { useEffect } from 'react';
import { getRealtimeSnapshot, startEventStream } from '../../shared/realtime/eventStream';
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
 * Poll interval used **only while the push channel is down**.
 *
 * The server-sent-events stream is the primary mechanism for noticing another
 * workstation's changes; this is its fallback, not a companion. When the stream
 * is `live` the interval fires and does nothing, because polling alongside a
 * working push channel is pure waste.
 *
 * It still earns its place: if the stream cannot connect — an aggressive proxy,
 * a browser that blocks it, a misconfigured deployment — the app degrades to
 * the Tier 1 behaviour of refreshing on a timer instead of going silently
 * stale. That failure mode is exactly what this whole effort set out to remove.
 */
const DEGRADED_POLL_MS = 60_000;

/**
 * Central revalidation driver.
 *
 * Mounted once, inside the authenticated shell. It owns the two ways the app
 * learns its cached data may be out of date:
 *
 *   1. **The push channel** — one `EventSource` per tab, open for the life of
 *      the session, turning a server-pushed `data-change` into a domain event.
 *   2. **Local triggers** — a domain event from a mutation in this tab,
 *      returning to the tab, regaining connectivity, and the degraded-mode poll.
 *
 * Every path funnels into the stores' `revalidate()`, which never blanks the
 * rendered data. That is what makes it safe for several of them to fire at once.
 *
 * @param isActive `false` while signed out, so a login screen neither polls nor
 *                 holds a stream open.
 */
export function useDataRevalidation(isActive: boolean): void {
  // The push channel's lifetime is the session's lifetime.
  useEffect(() => {
    if (!isActive) return;
    return startEventStream();
  }, [isActive]);

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

    // A domain event is authoritative: it is only emitted after a write
    // committed, here or on another workstation. `force` makes it bypass each
    // store's `staleTime` — otherwise a change pushed one second after a fetch
    // would be discarded for the next fifteen, which is the very staleness this
    // is meant to eliminate.
    const unsubscribe = subscribeToDataChanges((domains) =>
      revalidateDataDomains(domains, { force: true }),
    );

    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const pollId = window.setInterval(() => {
      if (getRealtimeSnapshot().status !== 'live') revalidateIfVisible();
    }, DEGRADED_POLL_MS);

    return () => {
      unsubscribe();
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(pollId);
    };
  }, [isActive]);
}
