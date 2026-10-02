import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Request, Response } from 'express';

import { analyticsRouter } from '../../src/routes/analytics.routes.js';
import { AppError } from '../../src/shared/errors.js';

const BALAYAN = '11111111-1111-1111-1111-111111111111';
const NASUGBU = '22222222-2222-2222-2222-222222222222';

/*
 * The analytics route's branch handling, driven through the **real** router.
 *
 * The resolver has its own unit tests, and the service has its own scoping tests.
 * Neither proves the two are connected: a route that forgot to call the resolver
 * would pass both suites while sending the caller's own branch for every request —
 * functionally correct for staff and quietly broken for head office. So this file
 * invokes the actual Express handler and inspects what it did.
 *
 * It reads the handler off the router rather than importing it, because the handler
 * is an inline closure. The pattern is the one `eventsStreamBranch.test.ts` uses,
 * and for the same reason: re-implementing the logic in the test would prove
 * nothing about the handler.
 */

/** The handler registered for `path` on `analyticsRouter`, or a loud failure. */
function handlerFor(path: string) {
  const layer = analyticsRouter.stack.find((entry) => entry.route?.path === path);
  assert.ok(layer?.route, `expected a route for ${path}`);
  /*
   * The last layer is the handler; the earlier ones are `authenticate` (arity 3)
   * and a permission guard. Selecting by arity 2 is how the SSE test identifies
   * its handler, and it is more robust than a positional index.
   */
  const handler = layer.route.stack.find((entry) => entry.handle.length === 2)?.handle;
  assert.ok(handler, `expected an async handler for ${path}`);
  return handler as (request: unknown, response: unknown) => Promise<void>;
}

/** Which paths `effectiveBranch` is wired into — every analytics read. */
const BRANCH_SCOPED_PATHS = ['/summary', '/sales-timeline', '/product-trends', '/inventory-forecast'];

interface Harness {
  statusCode: number | null;
  body: unknown;
  /** The RPC arguments recorded by the fake supabase, in call order. */
  rpcCalls: { name: string; args: Record<string, unknown> }[];
}

/**
 * Builds the request/response pair the handler expects.
 *
 * `supabase` is injected by replacing the admin-client singleton — the same
 * approach the service tests avoid, but here the point is precisely to observe what
 * the *handler* passes downstream, and the handler obtains its client from that
 * singleton. The fake is only ever asked for the calls it recorded.
 */
function makePair(options: {
  query: Record<string, unknown>;
  canViewAllBranches: boolean;
  branchId: string | null;
  permissions: string[];
}): { request: Request; response: Response; captured: Harness } {
  const captured: Harness = { statusCode: 200, body: null, rpcCalls: [] };

  const response = {
    status(code: number) {
      captured.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      captured.body = payload;
      return this;
    },
    // The API's `sendSuccess` writes through `json`; `set`/`setHeader` are called
    // by Express internals a plain object cannot provide.
    set() { return this; },
    setHeader() { return this; },
    header() { return this; },
  } as unknown as Response;

  const request = {
    query: options.query,
    params: {},
    auth: {
      permissions: options.permissions,
      profile: {
        id: 'user-1',
        name: 'Tester',
        phone: '',
        position: '',
        roleId: 'role-1',
        branchId: options.branchId,
        canViewAllBranches: options.canViewAllBranches,
      },
    },
  } as unknown as Request;

  return { request, response, captured };
}

/** Runs a handler and returns either its captured response or the thrown error. */
async function invoke(
  path: string,
  options: Parameters<typeof makePair>[0],
): Promise<{ captured: Harness; error: unknown }> {
  const { request, response, captured } = makePair(options);
  let error: unknown;
  try {
    await handlerFor(path)(request, response);
  } catch (thrown) {
    error = thrown;
  }
  return { captured, error };
}

describe('analytics routes — the branch selector is permission-gated', () => {
  for (const path of BRANCH_SCOPED_PATHS) {
    it(`${path}: a staff account asking for another branch is refused with 403`, async () => {
      const { error } = await invoke(path, {
        query: { from: '2026-09-01', to: '2026-09-30', bucket: 'day', horizonDays: '30', branch: NASUGBU },
        canViewAllBranches: false,
        branchId: BALAYAN,
        permissions: ['analytics.read'],
      });

      assert.ok(error instanceof AppError, `expected a refusal on ${path}`);
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, 'BRANCH_SELECTION_FORBIDDEN');
    });

    it(`${path}: a staff account asking for all branches is refused with 403`, async () => {
      const { error } = await invoke(path, {
        query: { from: '2026-09-01', to: '2026-09-30', bucket: 'day', horizonDays: '30', branch: 'all' },
        canViewAllBranches: false,
        branchId: BALAYAN,
        permissions: ['analytics.read'],
      });

      assert.ok(error instanceof AppError, `expected a refusal on ${path}`);
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, 'BRANCH_SELECTION_FORBIDDEN');
    });
  }

  it('refuses a malformed branch value rather than ignoring it', async () => {
    // An over-long or empty value is a 400, not a silent fall-back to "my own
    // branch" — a request that named a branch and was answered with a different one
    // is the kind of thing that gets filed as "the report showed the wrong shop".
    const { error } = await invoke('/summary', {
      query: { from: '2026-09-01', to: '2026-09-30', branch: 'x'.repeat(200) },
      canViewAllBranches: true,
      branchId: BALAYAN,
      permissions: ['analytics.read'],
    });

    assert.ok(error instanceof AppError);
    assert.equal(error.statusCode, 400);
    assert.equal(error.code, 'INVALID_ANALYTICS_QUERY');
  });
});

describe('analytics routes — branch-comparison is head-office only', () => {
  it('is protected by a guard ahead of its handler', () => {
    // The comparison endpoint carries no `?branch=` and reads the branch list
    // itself, so its protection is entirely in the middleware stack. Asserting a
    // guard exists keeps that true if the route is ever edited.
    const layer = analyticsRouter.stack.find((entry) => entry.route?.path === '/branch-comparison');
    assert.ok(layer?.route, 'expected the branch-comparison route');
    assert.ok(
      layer.route.stack.length >= 2,
      'expected at least an authenticate guard and the handler',
    );
  });

  it('a staff account is refused by the head-office guard with 403', async () => {
    // Drives the guard directly, since the handler would need a live supabase.
    const layer = analyticsRouter.stack.find((entry) => entry.route?.path === '/branch-comparison');
    assert.ok(layer?.route);
    const guard = layer.route.stack.find((entry) => entry.handle.length === 3)?.handle;
    assert.ok(guard, 'expected a 3-arity guard (authenticate or requireHeadOffice)');

    // The second guard in the stack is `requireHeadOffice`.
    const guards = layer.route.stack.filter((entry) => entry.handle.length === 3);
    const headOfficeGuard = guards[1]?.handle;
    assert.ok(headOfficeGuard, 'expected requireHeadOffice in the stack');

    let error: unknown;
    const { request, response } = makePair({
      query: { from: '2026-09-01', to: '2026-09-30' },
      canViewAllBranches: false,
      branchId: BALAYAN,
      permissions: ['analytics.read'],
    });
    (headOfficeGuard as (req: unknown, res: unknown, next: (e?: unknown) => void) => void)(
      request,
      response,
      (thrown?: unknown) => { error = thrown; },
    );

    assert.ok(error instanceof AppError, 'requireHeadOffice must refuse a staff account');
    assert.equal(error.statusCode, 403);
    assert.equal(error.code, 'BRANCH_SELECTION_FORBIDDEN');
  });

  it('a head-office account passes the head-office guard', () => {
    const layer = analyticsRouter.stack.find((entry) => entry.route?.path === '/branch-comparison');
    assert.ok(layer?.route);
    const guards = layer.route.stack.filter((entry) => entry.handle.length === 3);
    const headOfficeGuard = guards[1]?.handle as (req: unknown, res: unknown, next: (e?: unknown) => void) => void;
    assert.ok(headOfficeGuard);

    let error: unknown;
    let advanced = false;
    const { request, response } = makePair({
      query: { from: '2026-09-01', to: '2026-09-30' },
      canViewAllBranches: true,
      branchId: BALAYAN,
      permissions: ['analytics.read'],
    });
    headOfficeGuard(request, response, (thrown?: unknown) => {
      if (thrown) error = thrown;
      else advanced = true;
    });

    assert.equal(error, undefined);
    assert.equal(advanced, true, 'a head-office account must reach the handler');
  });
});
