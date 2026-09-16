/**
 * The realtime client, and specifically the keep-alive contract.
 *
 * Tier 2 shipped a heartbeat the browser could not see. The server sent a
 * `: ping` comment — which does keep the socket alive on the wire, but which
 * `EventSource` never surfaces to JavaScript. The client's silence watchdog
 * therefore saw nothing arriving on a perfectly healthy connection, declared it
 * half-open, and redialled every 75 seconds for the life of the session. Nothing
 * in a code review catches that; it took watching the live stream.
 *
 * The fix was to make the heartbeat a *named* event. These tests are the only
 * thing standing between that fix and a well-meaning revert, so they assert the
 * observable behaviour — frames arrive, the watchdog is satisfied, no reconnect
 * happens — rather than the implementation detail of which frame type is used.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { subscribeToDataChanges } from '../store/dataEvents';
import { getRealtimeSnapshot, startEventStream } from './eventStream';

/** Mirrors the constants in `eventStream.ts`. */
const SERVER_HEARTBEAT_INTERVAL_MS = 25_000;
const SILENCE_TIMEOUT_MS = SERVER_HEARTBEAT_INTERVAL_MS * 3;

/**
 * A controllable stand-in for the browser's `EventSource`.
 *
 * The real one cannot be driven from a test — it insists on a network — so this
 * reproduces just the surface `eventStream.ts` touches, plus `emit`/`fail` for
 * the test to play frames in.
 */
class FakeEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  static instances: FakeEventSource[] = [];

  readonly url: string;
  readonly withCredentials: boolean;
  readyState: number = FakeEventSource.CONNECTING;
  closed = false;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;

  private readonly listeners = new Map<string, Set<(event: MessageEvent<string>) => void>>();

  constructor(url: string, init?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = init?.withCredentials ?? false;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, handler: (event: MessageEvent<string>) => void): void {
    const handlers = this.listeners.get(type) ?? new Set();
    handlers.add(handler);
    this.listeners.set(type, handlers);
  }

  close(): void {
    this.closed = true;
    this.readyState = FakeEventSource.CLOSED;
  }

  /** Delivers a named frame, exactly as the server would. */
  emit(type: string, payload?: unknown): void {
    this.readyState = FakeEventSource.OPEN;
    const event = {
      data: payload === undefined ? undefined : JSON.stringify(payload),
    } as MessageEvent<string>;
    for (const handler of this.listeners.get(type) ?? []) handler(event);
  }

  /** The browser gave up: a non-200, or a wrong content-type. */
  fail(): void {
    this.readyState = FakeEventSource.CLOSED;
    this.onerror?.();
  }

  /** The most recently opened connection. */
  static latest(): FakeEventSource {
    const instance = FakeEventSource.instances.at(-1);
    if (!instance) throw new Error('no EventSource was constructed');
    return instance;
  }
}

const releases: Array<() => void> = [];

/** Opens the stream and registers the teardown, so no state leaks between tests. */
function open(): void {
  releases.push(startEventStream());
}

/** Brings the connection to the `live` state the server would produce. */
function goLive(domains: readonly string[] = ['orders', 'inventory', 'payments']): FakeEventSource {
  const stream = FakeEventSource.latest();
  stream.emit('connected', { domains });
  return stream;
}

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal('EventSource', FakeEventSource);
  // `refreshSession` fires a real request on a fatal error; stub it so no test
  // depends on the network being reachable.
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200 })));
  // The reconnect delay is jittered on purpose. Pinning the jitter makes the
  // backoff deterministic without removing the jitter from production.
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
});

afterEach(() => {
  while (releases.length > 0) releases.pop()?.();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('keep-alive', () => {
  it('stays live across a long quiet period when heartbeats keep arriving', () => {
    // Four intervals of nothing-but-heartbeats: 100 seconds of silence on a
    // healthy connection, comfortably past the 75-second watchdog.
    vi.useFakeTimers();
    open();
    const stream = goLive();

    for (let i = 0; i < 4; i += 1) {
      vi.advanceTimersByTime(SERVER_HEARTBEAT_INTERVAL_MS);
      stream.emit('heartbeat', { at: new Date().toISOString() });
    }

    expect(getRealtimeSnapshot().status).toBe('live');
    // The whole point: no redial. A comment-only heartbeat produced one per
    // interval here.
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(stream.closed).toBe(false);
  });

  it('reconnects when nothing at all arrives', () => {
    // The converse case. Without this, "never reconnect" would also pass the
    // test above, and the watchdog would be decorative.
    vi.useFakeTimers();
    open();
    const stream = goLive();

    vi.advanceTimersByTime(SILENCE_TIMEOUT_MS + 5_000);

    expect(getRealtimeSnapshot().status).toBe('reconnecting');
    expect(stream.closed).toBe(true);

    // The redial is on a timer, so it has not happened yet.
    expect(FakeEventSource.instances).toHaveLength(1);
    vi.advanceTimersByTime(2_000);
    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it('a data-change frame also counts as proof of life', () => {
    vi.useFakeTimers();
    open();
    const stream = goLive();

    // Traffic in place of a heartbeat must not be treated as silence.
    vi.advanceTimersByTime(SERVER_HEARTBEAT_INTERVAL_MS * 2);
    stream.emit('data-change', { domains: ['orders'], at: new Date().toISOString() });
    vi.advanceTimersByTime(SERVER_HEARTBEAT_INTERVAL_MS * 2);

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(getRealtimeSnapshot().status).toBe('live');
  });
});

describe('frame handling', () => {
  it('records the domains the server granted this session', () => {
    vi.useFakeTimers();
    open();
    goLive(['orders', 'inventory']);

    expect(getRealtimeSnapshot()).toMatchObject({ status: 'live', domains: ['orders', 'inventory'] });
  });

  it('turns a data-change frame into a domain event', () => {
    vi.useFakeTimers();
    const received: Array<readonly string[]> = [];
    const stop = subscribeToDataChanges((domains) => received.push(domains));
    open();
    goLive();

    FakeEventSource.latest().emit('data-change', { domains: ['inventory'], at: new Date().toISOString() });

    expect(received).toEqual([['inventory']]);
    expect(getRealtimeSnapshot().lastEventAt).not.toBeNull();
    stop();
  });

  it('drops a domain it does not recognise', () => {
    // The payload crosses a network boundary. An unknown domain would index the
    // revalidation registry with `undefined`.
    vi.useFakeTimers();
    const received: Array<readonly string[]> = [];
    const stop = subscribeToDataChanges((domains) => received.push(domains));
    open();
    goLive();

    FakeEventSource.latest().emit('data-change', { domains: ['orders', 'not-a-domain'], at: new Date().toISOString() });

    expect(received).toEqual([['orders']]);
    stop();
  });

  it('ignores a data-change frame whose payload is garbage', () => {
    vi.useFakeTimers();
    const received: Array<readonly string[]> = [];
    const stop = subscribeToDataChanges((domains) => received.push(domains));
    open();
    goLive();

    FakeEventSource.latest().emit('data-change');
    FakeEventSource.latest().emit('data-change', { domains: 'orders' });

    expect(received).toEqual([]);
    stop();
  });

  it('ignores frames from a connection it has already replaced', () => {
    // The hazard: a dead connection is not closed instantly — the client first
    // tries to refresh the session, and only then redials. A frame that arrives
    // late on the connection we walked away from must not be trusted, because
    // its payload describes a world we have already stopped believing in.
    vi.useFakeTimers();
    const received: Array<readonly string[]> = [];
    const stop = subscribeToDataChanges((domains) => received.push(domains));
    open();
    const abandoned = goLive();

    vi.advanceTimersByTime(SILENCE_TIMEOUT_MS + 5_000);
    vi.advanceTimersByTime(2_000);
    expect(FakeEventSource.instances).toHaveLength(2);

    abandoned.emit('data-change', { domains: ['orders'], at: new Date().toISOString() });

    expect(received).toEqual([]);
    stop();
  });
});

describe('connection lifecycle', () => {
  it('shares one connection between consumers', () => {
    // React 19 StrictMode mounts, unmounts and remounts effects. Two consumers
    // must not cost two of the browser's six connections per origin.
    vi.useFakeTimers();
    const releaseFirst = startEventStream();
    open();
    goLive();

    expect(FakeEventSource.instances).toHaveLength(1);

    releaseFirst();
    expect(FakeEventSource.latest().closed).toBe(false);
  });

  it('closes the connection when the last consumer releases it', () => {
    vi.useFakeTimers();
    const releaseOnly = startEventStream();
    goLive();

    releaseOnly();

    expect(FakeEventSource.latest().closed).toBe(true);
    expect(getRealtimeSnapshot().status).toBe('idle');
  });

  it('stops reconnecting once offline, and dials again when back online', () => {
    vi.useFakeTimers();
    open();
    const stream = goLive();

    window.dispatchEvent(new Event('offline'));
    expect(getRealtimeSnapshot().status).toBe('offline');
    expect(stream.closed).toBe(true);

    // Burning backoff attempts while the machine knows it is offline would
    // exhaust the ladder before the network is even back.
    vi.advanceTimersByTime(120_000);
    expect(FakeEventSource.instances).toHaveLength(1);

    window.dispatchEvent(new Event('online'));
    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it('refreshes the session before redialling after a fatal error', async () => {
    // A non-200 is fatal to `EventSource`, and the overwhelmingly likely cause
    // is an access token that expired while the tab sat idle. Redialling without
    // refreshing would just earn another 401 and burn a backoff attempt.
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    open();
    const stream = goLive();

    stream.fail();
    // The refresh is awaited before the reconnect is armed, so let it settle.
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/auth/refresh'), expect.anything());

    vi.advanceTimersByTime(2_000);
    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it('reconnects immediately when the tab becomes visible again', () => {
    // A laptop that slept comes back with a stream that is open but dead.
    vi.useFakeTimers();
    open();
    goLive();

    window.dispatchEvent(new Event('offline'));
    expect(FakeEventSource.instances).toHaveLength(1);

    document.dispatchEvent(new Event('visibilitychange'));

    expect(FakeEventSource.instances).toHaveLength(2);
  });
});
