import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import type { Request, Response } from 'express';

import { eventsRouter } from '../../src/routes/events.routes.js';
import { countDataChangeSubscribers, publishDataChange } from '../../src/services/domainEventBus.js';

/*
 * The event stream's branch filter.
 *
 * ### Why this file drives the real router
 *
 * The filter is four lines inside a handler, and the tempting shortcut is to
 * re-implement those four lines in the test and assert on the copy. That proves
 * nothing: the copy passes while the handler is wrong. So the handler itself is
 * invoked, over a fake Express request/response pair, and the real module-level
 * bus is published into. What is asserted is the bytes the socket actually
 * received.
 *
 * ### What a leak would be
 *
 * The payload carries no business rows — only domain names and a timestamp — so
 * a branch leak here exposes no record. It exposes *rhythm*: a Balayan sale told
 * every Nasugbu workstation to refetch, and over a day the frequency of those
 * reloads tells one shop how busy the other is. That is the leak the branch
 * filter closes, and the reason it cannot be dropped as "only domain names".
 */

const BALAYAN = 'branch-balayan';
const NASUGbu = 'branch-nasugbu';

/** The permission set a seeded staff account holds — everything but `users`. */
const STAFF_PERMISSIONS = [
  'orders.read',
  'inventory.read',
  'customers.read',
  'designs.read',
  'payments.read',
  'settings.read',
];

/** Everything an admin holds, including `users.read`. */
const ADMIN_PERMISSIONS = [...STAFF_PERMISSIONS, 'users.read'];

interface OpenStream {
  /** Every frame written to the socket, in order, as `{ event, data }`. */
  frames: { event: string; data: unknown }[];
  close: () => void;
}

/**
 * Opens the real handler over a fake socket, and returns what was written.
 *
 * `flushHeaders` and `setTimeout` are the two response methods the handler calls
 * that a plain object cannot fake, so they are stubbed; `write` is captured. The
 * heartbeat interval is 25 s, far beyond the life of a test, so no timer needs
 * clearing beyond the one `close()` triggers.
 */
function openStream(options: { branchId: string | null; permissions: string[] }): OpenStream {
  const frames: { event: string; data: unknown }[] = [];
  const listeners = new Map<string, () => void>();

  const request = {
    auth: {
      user: { id: 'user-1' },
      profile: { branchId: options.branchId, canViewAllBranches: false },
      permissions: options.permissions,
    },
    setTimeout: () => undefined,
    on: (event: string, handler: () => void) => {
      listeners.set(event, handler);
    },
  } as unknown as Request;

  const response = {
    status: () => response,
    set: () => response,
    flushHeaders: () => undefined,
    writableEnded: false,
    // The route registers a `response.on('error', …)` handler as half of its
    // teardown path. Recorded so nothing is lost, and satisfied so the fake
    // socket is shaped like the real one.
    on: () => response,
    write: (chunk: string) => {
      // Frames arrive as `event: <name>\ndata: <json>\n\n`.
      const event = /^event: (.+)$/m.exec(chunk)?.[1];
      const raw = /^data: (.+)$/m.exec(chunk)?.[1];
      if (event) frames.push({ event, data: raw === undefined ? undefined : JSON.parse(raw) });
      return true;
    },
  } as unknown as Response;

  /*
   * `GET /` is registered as `authenticate, handler`. The handler is the one
   * with **arity 2** — `authenticate` takes `(req, res, next)` — and picking it
   * by arity is deliberate: the alternative is an index, and an index silently
   * becomes a different function the day a middleware is inserted. Driving the
   * wrong one would test `authenticate` against a fake request, which is why
   * this file asserts on what the socket received rather than trusting a name.
   */
  const route = eventsRouter.stack[0]?.route;
  assert.ok(route?.path === '/', 'eventsRouter must expose a GET / route');
  const handler = route.stack.find((layer) => layer.handle.length === 2)?.handle as
    | ((req: Request, res: Response) => void)
    | undefined;
  assert.ok(handler, 'the GET / route must have the stream handler (arity 2)');
  handler(request, response);

  return {
    frames,
    close: () => {
      listeners.get('close')?.();
    },
  };
}

/** Frames of a given name, ignoring the `connected` greeting and heartbeats. */
function changes(stream: OpenStream): { event: string; data: unknown }[] {
  return stream.frames.filter((frame) => frame.event === 'data-change');
}

/*
 * Every stream opened by a test is closed so no subscriber leaks between tests.
 * A leaked subscriber would keep receiving events and make a later test's frame
 * count wrong — a flake that only appears when the whole file runs together.
 */
const openStreams: OpenStream[] = [];
function stream(options: { branchId: string | null; permissions: string[] }): OpenStream {
  const opened = openStream(options);
  openStreams.push(opened);
  return opened;
}
afterEach(() => {
  while (openStreams.length > 0) openStreams.pop()?.close();
  assert.equal(countDataChangeSubscribers(), 0, 'every stream must unsubscribe on close');
});

describe('SSE event stream branch scoping', () => {
  it('greets the client with its own branch, so a mis-scoped stream is visible', () => {
    const connected = stream({ branchId: BALAYAN, permissions: STAFF_PERMISSIONS }).frames[0];

    assert.equal(connected?.event, 'connected');
    const data = connected?.data as { branchId: string | null; domains: string[] };
    assert.equal(data.branchId, BALAYAN);
    assert.deepEqual(data.domains, [
      'orders',
      'inventory',
      'customers',
      'designs',
      'payments',
      'settings',
    ]);
  });

  it('delivers a change made in the subscriber’s own branch', () => {
    const subscriber = stream({ branchId: BALAYAN, permissions: STAFF_PERMISSIONS });

    publishDataChange(BALAYAN, 'orders');

    const received = changes(subscriber);
    assert.equal(received.length, 1);
    assert.deepEqual((received[0]?.data as { domains: string[] }).domains, ['orders']);
  });

  it('does NOT deliver a change made in the other branch', () => {
    /*
     * The core assertion of this phase's second hole. Before the branch filter,
     * this frame arrived: no row, but the timing of the other shop's trade.
     */
    const subscriber = stream({ branchId: BALAYAN, permissions: STAFF_PERMISSIONS });

    publishDataChange(NASUGbu, 'orders');

    assert.equal(changes(subscriber).length, 0);
  });

  it('does not let a forged branch claim a foreign change', () => {
    /*
     * The subscriber's branch comes from `request.auth.profile` — put there by
     * the authenticate middleware from the database row — and there is no code
     * path from the query string, body or headers to it. This test states the
     * contract at the level the handler sees: the branch on the request is the
     * only input, and it is compared, never trusted from the event.
     */
    const subscriber = stream({ branchId: NASUGbu, permissions: STAFF_PERMISSIONS });

    publishDataChange(BALAYAN, 'orders');
    publishDataChange(NASUGbu, 'inventory');

    const received = changes(subscriber);
    assert.equal(received.length, 1, 'only the event matching the subscriber branch may arrive');
    assert.deepEqual((received[0]?.data as { domains: string[] }).domains, ['inventory']);
  });

  it('delivers a branch-less change to every branch', () => {
    /*
     * `null` means business-wide — a user account or a shared setting. It is
     * deliberately not filtered, or an admin edit made at head office would never
     * reach the branches whose screens show it.
     */
    const subscriber = stream({ branchId: BALAYAN, permissions: STAFF_PERMISSIONS });

    publishDataChange(null, 'settings');

    const received = changes(subscriber);
    assert.equal(received.length, 1);
    assert.equal((received[0]?.data as { branchId: string | null }).branchId, null);
  });

  it('still enforces the domain filter on top of the branch filter', () => {
    /*
     * The two filters are independent and both must hold: the branch filter
     * answers "is this mine?", the domain filter answers "may I know about this
     * kind of change at all?". Staff do not hold `users.read`, so a user edit —
     * even a branch-less one — must not reach them.
     */
    const staff = stream({ branchId: BALAYAN, permissions: STAFF_PERMISSIONS });

    publishDataChange(null, 'users');

    assert.equal(changes(staff).length, 0);
  });

  it('delivers a users change to an admin who holds the permission', () => {
    // The other side of the same rule, so the test above is not passing merely
    // because `users` events are dropped for everyone.
    const admin = stream({ branchId: BALAYAN, permissions: ADMIN_PERMISSIONS });

    publishDataChange(null, 'users');

    const received = changes(admin);
    assert.equal(received.length, 1);
    assert.deepEqual((received[0]?.data as { domains: string[] }).domains, ['users']);
  });

  it('gives a branch-less account only branch-less events', () => {
    /*
     * A profile with no branch is refused by every branch-owned route, but this
     * endpoint has no permission gate, so it can still be reached. Its scope is
     * `null`, which means it receives business-wide events and **no** branch's
     * trading — the honest answer rather than assuming a branch is present.
     */
    const unassigned = stream({ branchId: null, permissions: STAFF_PERMISSIONS });

    publishDataChange(BALAYAN, 'orders');
    publishDataChange(NASUGbu, 'orders');
    publishDataChange(null, 'settings');

    const received = changes(unassigned);
    assert.equal(received.length, 1);
    assert.equal((received[0]?.data as { branchId: string | null }).branchId, null);
  });

  it('narrows a multi-domain event to the domains the subscriber may see', () => {
    // One publish may announce several domains. The filter must be applied
    // per-domain, not to the event as a whole: dropping the whole event would
    // lose the `orders` half a staff member is entitled to.
    const staff = stream({ branchId: BALAYAN, permissions: STAFF_PERMISSIONS });

    publishDataChange(BALAYAN, 'orders', 'users');

    const received = changes(staff);
    assert.equal(received.length, 1);
    assert.deepEqual((received[0]?.data as { domains: string[] }).domains, ['orders']);
  });

  it('unsubscribes on close so a dead socket is never written to', () => {
    const subscriber = stream({ branchId: BALAYAN, permissions: STAFF_PERMISSIONS });
    subscriber.close();

    publishDataChange(BALAYAN, 'orders');

    assert.equal(changes(subscriber).length, 0);
  });
});
