import { Router } from 'express';
import type { Response } from 'express';
import type { DataChangeEvent, DataDomain, RealtimeEventName } from '@printsync/shared-types';
import { authenticate } from '../middleware/authenticate.js';
import { countDataChangeSubscribers, subscribeToDataChange } from '../services/domainEventBus.js';
import { visibleDomainsFor } from '../services/dataChangePermissions.js';
import { logger } from '../shared/logger.js';

export const eventsRouter = Router();

/**
 * Server-sent events: the API pushes "domain X changed" to every connected
 * browser, so a change made at one workstation reaches the others in under a
 * second instead of waiting for a poll.
 *
 * ### Why SSE and not WebSockets
 *
 * The traffic is one-directional (server to client), SSE reconnects on its own,
 * and it rides on plain HTTP so the existing `HttpOnly` cookie session
 * authenticates it with no new mechanism. WebSockets would add a second protocol
 * and a handshake to maintain for no capability we need.
 *
 * ### Why not Supabase Realtime
 *
 * That would mean shipping the Supabase anon key to the browser and making RLS
 * the security boundary, which contradicts the standing decision that the
 * frontend never talks to Supabase directly (README, "Security notes"). This
 * endpoint keeps the service-role key server-side where it belongs.
 */

/**
 * How often to send a comment frame to keep the connection alive.
 *
 * Idle SSE connections are dropped by proxies and load balancers — nginx's
 * `proxy_read_timeout` defaults to 60s, many managed load balancers to 30s, and
 * Vite's dev proxy will hold a stalled socket. 25s sits comfortably under all of
 * them. A comment (`: ping`) rather than a named event, so it never surfaces as
 * a message to client code.
 *
 * The browser client mirrors this value to decide when a silent socket should be
 * presumed dead — see `SERVER_HEARTBEAT_INTERVAL_MS` in
 * `frontend/src/shared/realtime/eventStream.ts`. Change one, change both.
 */
const HEARTBEAT_INTERVAL_MS = 25_000;

function writeFrame(response: Response, event: RealtimeEventName, payload: unknown): void {
  response.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

/**
 * `GET /api/v1/events`
 *
 * Deliberately guarded by `authenticate` only — **not** `requirePermission`.
 *
 * There is no single capability that describes "may watch for changes": the
 * stream spans every domain, and the correct gate differs per domain. Requiring
 * one broad permission would either lock staff out of the inventory events their
 * POS catalogue needs, or hand them admin-only `users` events. The gate is
 * applied per event instead, via `visibleDomainsFor` below.
 *
 * See `services/dataChangePermissions.ts` for exactly which domains a staff
 * session receives.
 */
eventsRouter.get('/', authenticate, (request, response) => {
  const allowedDomains = visibleDomainsFor(request.auth?.permissions ?? []);
  const allowed = new Set<DataDomain>(allowedDomains);

  response.status(200);
  response.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    // `no-transform` matters: without it an intermediary is permitted to buffer
    // or recompress the stream, which defeats the whole point.
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Belt and braces for nginx, which otherwise buffers proxied responses.
    'X-Accel-Buffering': 'no',
  });
  // Sends the headers immediately. Without this the client sees no response
  // until the first event, and EventSource reports a connection that never opens.
  response.flushHeaders();

  let closed = false;

  const send = (event: RealtimeEventName, payload: unknown) => {
    if (closed || response.writableEnded) return;
    writeFrame(response, event, payload);
  };

  // Tells the client which domains it will actually receive, so the UI can
  // distinguish "connected but nothing to watch" from "connected".
  send('connected', { domains: allowedDomains, at: new Date().toISOString() });

  const unsubscribe = subscribeToDataChange((event: DataChangeEvent) => {
    const visible = event.domains.filter((domain) => allowed.has(domain));
    if (visible.length === 0) return;
    send('data-change', { domains: visible, at: event.at });
  });

  const heartbeat = setInterval(() => {
    if (closed || response.writableEnded) return;
    response.write(': ping\n\n');
  }, HEARTBEAT_INTERVAL_MS);

  /**
   * Single teardown path.
   *
   * Both `close` and `error` route through here, and it is idempotent — a
   * socket that errors and then closes must not unsubscribe twice or leave an
   * interval running. A leaked interval keeps the process awake and a leaked
   * subscriber writes to a dead socket forever, so this is the part of an SSE
   * endpoint that actually matters.
   */
  const teardown = (reason: string) => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    unsubscribe();
    logger.debug(
      { userId: request.auth?.user.id, reason, remaining: countDataChangeSubscribers() },
      'SSE client disconnected',
    );
  };

  request.on('close', () => teardown('client closed'));
  response.on('error', (error) => {
    logger.warn('SSE response stream errored', {
      userId: request.auth?.user.id,
      message: error instanceof Error ? error.message : String(error),
    });
    teardown('response error');
  });

  logger.info('SSE client connected', {
    userId: request.auth?.user.id,
    domains: allowedDomains,
    subscribers: countDataChangeSubscribers(),
  });
});
