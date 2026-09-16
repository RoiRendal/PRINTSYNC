/**
 * Base URL of the PrintSync REST API.
 *
 * Extracted from `client.ts` because the realtime transport
 * (`shared/realtime/eventStream.ts`) also needs it: server-sent events are
 * fetched by the browser's own `EventSource`, not by `apiClient`, so the two
 * cannot share a request function — but they must not disagree about where the
 * API lives either.
 *
 * Defaults to the same-origin `/api/v1`, which is what the Vite dev proxy and a
 * same-host production deploy both expect. `frontend/.env` overrides it with an
 * absolute URL, which makes every request cross-origin — hence the
 * `credentials: 'include'` on the REST client and `withCredentials` on the
 * stream.
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
