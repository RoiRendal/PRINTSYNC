/**
 * The data-change contract shared by the API and the browser client.
 *
 * When a mutation commits, the API announces which domain it touched. The
 * frontend consumes that announcement and revalidates the affected caches.
 * Both sides must agree on the vocabulary, so the union lives here rather than
 * being declared twice and drifting.
 *
 * This module is **types only** on purpose. The frontend consumes
 * `@printsync/shared-types` as a type-only dependency (it has no Vite alias, so
 * a value import would fail to resolve at build time). Adding a runtime value
 * here would silently break the SPA build — keep it to `type`/`interface`.
 */

/**
 * A domain of the application whose data can change.
 *
 * Deliberately coarse. It answers "which cached collection is now suspect?"
 * rather than "what exactly changed?" — a client that knows the domain can
 * refetch, and refetching is cheap. Finer granularity would mean every consumer
 * has to handle partial updates for no practical gain.
 */
export type DataDomain =
  | 'orders'
  | 'inventory'
  | 'customers'
  | 'designs'
  | 'users'
  | 'payments'
  | 'settings';

/**
 * Server-sent event names.
 *
 * `connected` is sent once when the stream is established, so the client can
 * distinguish "live" from "still dialling". `data-change` carries a
 * `DataChangeEvent` payload.
 *
 * `heartbeat` is a keep-alive, and it is a named event rather than a `: ping`
 * comment on purpose — the browser's `EventSource` never surfaces comment frames
 * to script, so a client watching for silence cannot see them.
 */
export type RealtimeEventName = 'connected' | 'data-change' | 'heartbeat';

/**
 * Payload of a `data-change` event.
 *
 * Domains are batched into one event so a single user action that touches
 * several domains (a retail sale writes a payment *and* decrements stock)
 * wakes each subscriber once instead of once per domain.
 */
export interface DataChangeEvent {
  /** The domains whose data changed. Never empty. */
  domains: DataDomain[];
  /**
   * The branch whose data changed, or `null` for a change with no branch.
   *
   * This is what keeps the push channel honest across branches. A change made at
   * Balayan must not tell a Nasugbu workstation to refetch — the refetch would
   * return nothing new, and the *signal itself* would leak cross-branch
   * activity: a quiet branch could infer the other shop's trading rhythm purely
   * from how often its screens were told to reload.
   *
   * `null` is for the few changes that genuinely belong to no branch — a user
   * account, a business-wide setting. Those fan out to everyone.
   */
  branchId: string | null;
  /** ISO-8601 instant the change was announced, for debugging and ordering. */
  at: string;
}
