/**
 * Server-sent-events client.
 *
 * Holds one long-lived `EventSource` per browser tab and turns every
 * `data-change` frame the server pushes into a local `emitDataChange(...)`, so
 * the existing revalidation layer refreshes the affected pages without anyone
 * reloading.
 *
 * ### Why `EventSource` and not a WebSocket
 *
 * The traffic is one-directional, the browser reconnects natively, and the
 * connection is a plain credentialed HTTP request — so the existing `HttpOnly`
 * session cookie authenticates it with no token handling in JavaScript.
 *
 * ### What `EventSource` does *not* do for us
 *
 * The native retry is not sufficient on its own, which is why this module is
 * more than a few lines:
 *
 *   1. **A non-200 response is fatal.** If the access token expired while the
 *      tab sat idle, the reconnect gets a 401 and the browser closes the stream
 *      permanently instead of retrying. We detect `CLOSED` and refresh the
 *      session before dialling again.
 *   2. **Half-open sockets look healthy.** If the network drops without a TCP
 *      reset — a laptop sleeping, a switch rebooting — the stream stays "open"
 *      and silently delivers nothing. The watchdog below notices the missing
 *      heartbeat and forces a fresh connection.
 *   3. **Retries need spacing.** A shop full of workstations all reconnecting on
 *      the browser's fixed 3-second timer would stampede the API. Backoff with
 *      jitter spreads them out.
 */

import type { DataChangeEvent, DataDomain } from '@printsync/shared-types';
import { API_BASE_URL } from '../api/baseUrl';
import { emitDataChange, isDataDomain } from '../store/dataEvents';

/** Connection state, for the UI indicator. */
export type RealtimeStatus = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'offline';

export interface RealtimeSnapshot {
  status: RealtimeStatus;
  /**
   * The domains the server said this session will receive, from the `connected`
   * frame. Empty until the first successful connection.
   */
  domains: readonly DataDomain[];
  /** Epoch ms of the last `data-change` frame, or `null` if none yet. */
  lastEventAt: number | null;
}

/** First retry delay. Doubles per attempt up to `MAX_RECONNECT_DELAY_MS`. */
const INITIAL_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
/** ±20% spread, so workstations that dropped together do not return together. */
const RECONNECT_JITTER_RATIO = 0.2;

/**
 * Must match `HEARTBEAT_INTERVAL_MS` in `backend/src/routes/events.routes.ts`.
 * The server sends a `heartbeat` event this often; if we go three intervals
 * without hearing anything, the socket is presumed dead.
 */
const SERVER_HEARTBEAT_INTERVAL_MS = 25_000;
const SILENCE_TIMEOUT_MS = SERVER_HEARTBEAT_INTERVAL_MS * 3;
const WATCHDOG_TICK_MS = 5_000;

const EMPTY_SNAPSHOT: RealtimeSnapshot = { status: 'idle', domains: [], lastEventAt: null };

let snapshot: RealtimeSnapshot = EMPTY_SNAPSHOT;
const statusListeners = new Set<() => void>();

let source: EventSource | null = null;
let reconnectTimer: number | null = null;
let watchdogTimer: number | null = null;
let reconnectAttempt = 0;
let lastFrameAt = 0;
/** `true` once a connection has succeeded at least once in this session. */
let hasBeenLive = false;
/** Stops the 401 refresh from running more than once per backoff cycle. */
let refreshAttempted = false;
/** Reference count — see `startEventStream`. */
let activeConsumers = 0;

function publishSnapshot(next: Partial<RealtimeSnapshot>): void {
  const merged: RealtimeSnapshot = { ...snapshot, ...next };
  // `useSyncExternalStore` re-renders whenever the snapshot identity changes, so
  // it must only change when a field genuinely did.
  if (
    merged.status === snapshot.status &&
    merged.domains === snapshot.domains &&
    merged.lastEventAt === snapshot.lastEventAt
  ) {
    return;
  }
  snapshot = merged;
  for (const listener of [...statusListeners]) listener();
}

/** Current connection state. Stable identity between changes. */
export function getRealtimeSnapshot(): RealtimeSnapshot {
  return snapshot;
}

/** Subscribes to connection-state changes. Returns an unsubscribe function. */
export function subscribeToRealtimeStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

function streamUrl(): string {
  return `${API_BASE_URL}/events`;
}

function clearReconnectTimer(): void {
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function stopWatchdog(): void {
  if (watchdogTimer !== null) {
    window.clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
}

function closeSource(): void {
  if (!source) return;
  // Drop our reference first: the handlers below bail out when `source` no
  // longer matches, so a `close()` that fires `onerror` cannot recurse.
  const previous = source;
  source = null;
  previous.close();
}

function nextReconnectDelay(): number {
  const base = Math.min(
    INITIAL_RECONNECT_DELAY_MS * 2 ** reconnectAttempt,
    MAX_RECONNECT_DELAY_MS,
  );
  const jitter = base * RECONNECT_JITTER_RATIO * (Math.random() * 2 - 1);
  return Math.max(500, Math.round(base + jitter));
}

/**
 * Asks the API to rotate the session cookie before reconnecting.
 *
 * Only called when the browser gave up on the stream, which is what a 401 looks
 * like from here. Without it, a workstation left open past the access-token
 * lifetime would never re-establish the stream, because nothing else in the app
 * makes a request while the screen sits idle.
 *
 * The response is ignored on purpose: if the refresh failed there is no session
 * to restore, and the reconnect attempt will discover that for itself.
 */
async function refreshSession(): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    });
  } catch {
    // Unreachable API, or offline. The backoff below covers both.
  }
}

function scheduleReconnect(reason: string): void {
  if (activeConsumers === 0) return;
  // A failure can be reported twice — `onerror` and the watchdog can both fire
  // for one drop. Only the first should arm the timer.
  if (reconnectTimer !== null) return;

  stopWatchdog();
  closeSource();
  publishSnapshot({ status: 'reconnecting' });

  const delay = nextReconnectDelay();
  reconnectAttempt += 1;
  if (import.meta.env.DEV) {
    console.debug(`[realtime] reconnecting in ${delay}ms (${reason})`);
  }
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

function startWatchdog(): void {
  stopWatchdog();
  watchdogTimer = window.setInterval(() => {
    if (activeConsumers === 0 || !source) return;
    if (Date.now() - lastFrameAt <= SILENCE_TIMEOUT_MS) return;
    // Nothing has arrived for three heartbeat intervals — not even a keep-alive.
    // The socket is half-open and the browser has no way to tell, so only a new
    // connection recovers it.
    scheduleReconnect('heartbeat timeout');
  }, WATCHDOG_TICK_MS);
}

/** Parses a frame payload, returning `null` rather than throwing on garbage. */
function parseFrame<T>(event: Event): T | null {
  const data = (event as MessageEvent<unknown>).data;
  if (typeof data !== 'string') return null;
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

function connect(): void {
  if (activeConsumers === 0 || source) return;

  publishSnapshot({ status: reconnectAttempt > 0 ? 'reconnecting' : 'connecting' });

  let stream: EventSource;
  try {
    stream = new EventSource(streamUrl(), { withCredentials: true });
  } catch {
    // Thrown for a malformed URL. Retrying cannot help, but a later
    // `online`/visibility trigger will try again.
    scheduleReconnect('constructor threw');
    return;
  }

  source = stream;
  lastFrameAt = Date.now();
  startWatchdog();

  stream.addEventListener('connected', (event) => {
    if (stream !== source) return;
    lastFrameAt = Date.now();
    reconnectAttempt = 0;
    refreshAttempted = false;
    hasBeenLive = true;
    const payload = parseFrame<{ domains?: unknown }>(event);
    const domains = Array.isArray(payload?.domains)
      ? payload.domains.filter(isDataDomain)
      : [];
    publishSnapshot({ status: 'live', domains });
  });

  stream.addEventListener('data-change', (event) => {
    if (stream !== source) return;
    lastFrameAt = Date.now();
    const payload = parseFrame<DataChangeEvent>(event);
    if (!payload || !Array.isArray(payload.domains)) return;
    // The payload crosses a network boundary, so it is untrusted input: a bad
    // domain would index `DOMAIN_REVALIDATORS` with `undefined`.
    const domains = payload.domains.filter(isDataDomain);
    if (domains.length === 0) return;
    publishSnapshot({ lastEventAt: Date.now() });
    emitDataChange(...domains);
  });

  /*
   * The server's keep-alive, and the only frame that arrives while nothing is
   * happening. Listening for it is what makes the watchdog below correct: a
   * `: ping` comment keeps the socket alive on the wire but `EventSource` never
   * surfaces it to script, so a comment-only heartbeat would leave the watchdog
   * seeing silence on a perfectly healthy connection and reconnecting every
   * interval for no reason.
   */
  stream.addEventListener('heartbeat', () => {
    if (stream !== source) return;
    lastFrameAt = Date.now();
  });

  stream.onopen = () => {
    if (stream !== source) return;
    lastFrameAt = Date.now();
  };

  stream.onerror = () => {
    if (stream !== source || activeConsumers === 0) return;

    // `CONNECTING` means the browser is retrying on its own — leave it be, the
    // watchdog escalates if those retries never succeed.
    if (stream.readyState !== EventSource.CLOSED) {
      publishSnapshot({ status: 'reconnecting' });
      return;
    }

    // Fatal: a non-200 or a wrong content-type. The most likely cause by far is
    // an expired access token, so try one refresh before backing off.
    if (hasBeenLive && !refreshAttempted) {
      refreshAttempted = true;
      void refreshSession().finally(() => scheduleReconnect('stream closed'));
      return;
    }
    scheduleReconnect('stream closed');
  };
}

function handleOffline(): void {
  if (activeConsumers === 0) return;
  // Do not burn reconnect attempts while the machine knows it is offline; the
  // `online` handler reconnects immediately.
  clearReconnectTimer();
  stopWatchdog();
  closeSource();
  publishSnapshot({ status: 'offline' });
}

function handleOnline(): void {
  if (activeConsumers === 0 || source) return;
  clearReconnectTimer();
  reconnectAttempt = 0;
  refreshAttempted = false;
  connect();
}

/** Reconnects a stream that died while the tab was hidden (sleep, throttling). */
function handleVisibility(): void {
  if (activeConsumers === 0 || source) return;
  if (document.visibilityState !== 'visible') return;
  clearReconnectTimer();
  reconnectAttempt = 0;
  refreshAttempted = false;
  connect();
}

function begin(): void {
  window.addEventListener('offline', handleOffline);
  window.addEventListener('online', handleOnline);
  document.addEventListener('visibilitychange', handleVisibility);

  if (navigator.onLine === false) {
    publishSnapshot({ status: 'offline' });
    return;
  }
  connect();
}

function end(): void {
  window.removeEventListener('offline', handleOffline);
  window.removeEventListener('online', handleOnline);
  document.removeEventListener('visibilitychange', handleVisibility);
  clearReconnectTimer();
  stopWatchdog();
  closeSource();
  reconnectAttempt = 0;
  refreshAttempted = false;
  hasBeenLive = false;
  snapshot = EMPTY_SNAPSHOT;
  for (const listener of [...statusListeners]) listener();
}

/**
 * Opens the stream, or joins the one already open.
 *
 * Reference counted because React 19's StrictMode mounts effects, unmounts them,
 * and mounts them again in development. A naive implementation would open,
 * close and reopen the stream — and, worse, a second consumer would open a
 * *second* connection, spending one of the browser's six connections per origin
 * for nothing.
 *
 * @returns a release function; call it from the effect cleanup. The stream
 *          closes when the last consumer releases it.
 */
export function startEventStream(): () => void {
  activeConsumers += 1;
  if (activeConsumers === 1) begin();

  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeConsumers -= 1;
    if (activeConsumers === 0) end();
  };
}
