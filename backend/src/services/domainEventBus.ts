import type { DataChangeEvent, DataDomain } from '@printsync/shared-types';
import { logger } from '../shared/logger.js';

/**
 * In-process fan-out for "domain X changed" announcements.
 *
 * This is the server-side counterpart to the frontend's
 * `shared/store/dataEvents.ts`. A mutation route publishes here after its write
 * commits; the SSE endpoint (`routes/events.routes.ts`) subscribes on behalf of
 * every connected browser and forwards the event to the clients allowed to see
 * it.
 *
 * ### Why a module singleton
 *
 * Every router and service in this codebase is a module-level singleton, and the
 * API runs as a single long-lived process (`server.ts` calls `app.listen`), so a
 * module-level bus matches the surrounding architecture and needs no wiring.
 *
 * ### Scope limit — read this before scaling out
 *
 * The bus only reaches clients connected to **this** process. The moment the API
 * runs as more than one instance (or behind a load balancer), a change handled by
 * instance A will not reach a browser attached to instance B. The fix is to
 * replace the transport with Postgres `LISTEN`/`NOTIFY` — which is why the
 * surface here is deliberately tiny: `publishDataChange` and
 * `subscribeToDataChange` are the only things call sites know about, so swapping
 * the transport does not touch them.
 *
 * ### Delivery is best-effort
 *
 * Publishing never throws and never blocks. A subscriber that throws is logged
 * and skipped so one broken connection cannot stop the others, and a write that
 * has already committed is never rolled back because an event failed to send.
 * Clients treat a missed event as "possibly stale" and recover on the next
 * revalidation trigger, so losing one is safe.
 */

type Subscriber = (event: DataChangeEvent) => void;

const subscribers = new Set<Subscriber>();

/** Total events published since boot. Exposed for diagnostics and tests. */
let publishedCount = 0;

/**
 * Subscribes to data-change announcements.
 *
 * @returns an unsubscribe function. Callers **must** invoke it — the SSE route
 *          calls it from `request.on('close')`. A subscriber that is never
 *          removed leaks for the lifetime of the process.
 */
export function subscribeToDataChange(subscriber: Subscriber): () => void {
  subscribers.add(subscriber);
  return () => {
    subscribers.delete(subscriber);
  };
}

/**
 * Announces that one or more domains changed.
 *
 * Call this **after** the database write has committed — never before. An event
 * published for a write that then fails would make every client refetch data
 * that never changed.
 *
 * Duplicate domains are collapsed, so `publishDataChange('inventory',
 * 'inventory')` notifies once.
 */
export function publishDataChange(...domains: DataDomain[]): void {
  if (domains.length === 0) return;

  const event: DataChangeEvent = {
    domains: [...new Set(domains)],
    at: new Date().toISOString(),
  };
  publishedCount += 1;

  // Iterate a copy: a subscriber may unsubscribe while we are dispatching (for
  // example a client disconnecting mid-loop), which would otherwise mutate the
  // Set during iteration.
  for (const subscriber of [...subscribers]) {
    try {
      subscriber(event);
    } catch (error) {
      logger.error('Data-change subscriber threw', {
        domains: event.domains,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/** Number of live subscribers. Used by tests and for diagnosing stuck streams. */
export function countDataChangeSubscribers(): number {
  return subscribers.size;
}

/** Number of events published since boot. */
export function countPublishedDataChanges(): number {
  return publishedCount;
}
