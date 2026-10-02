import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { assertRowBelongsToBranch } from '../../src/shared/branchContext.js';
import { assertAppError } from './helpers/assertAppError.js';
import { FakeSupabase, createFakeSupabase } from './helpers/fakeSupabase.js';

/*
 * `assertRowBelongsToBranch` is the single refusal point for the entry points
 * that act on a row **by id alone** — the money RPCs and the order-payment
 * handlers — and so cannot put the branch in their own WHERE clause. Its three
 * outcomes are all security-relevant, and each is easy to get wrong in a way no
 * other test would catch:
 *
 *   - the caller's own row passes (otherwise every legitimate action breaks);
 *   - another branch's row is refused the same way a missing row is
 *     (**404 to the client**, so an id cannot be probed for existence);
 *   - a lookup failure is a 503, not a 404 — a database blip must not be
 *     reported as "this record is gone", which would look like a successful
 *     authorization decision made on no evidence.
 *
 * The last is the subtle one. If a transient read error fell through to the
 * 404 branch, a caller would be told a record does not exist when the truth is
 * "we could not tell" — and a support engineer would chase a deletion that never
 * happened.
 */

const CALLER_BRANCH = 'branch-balayan';
const OTHER_BRANCH = 'branch-nasugbu';

/** Options every test shares, so a failure names the same row throughout. */
const baseOptions = {
  table: 'orders',
  id: 'order-1',
  entityLabel: 'order',
  notFoundCode: 'ORDER_NOT_FOUND',
} as const;

describe('assertRowBelongsToBranch', () => {
  it('resolves when the row belongs to the caller branch', async () => {
    const db = createFakeSupabase();
    db.onTable('orders', { data: { id: 'order-1', branch_id: CALLER_BRANCH }, error: null });

    await assertRowBelongsToBranch(db.client, { ...baseOptions, branchId: CALLER_BRANCH });
  });

  it('reads the row by id alone, and only its id and branch', async () => {
    // The check must be a narrow lookup. If it selected `*`, a caller that is
    // about to be refused would still have pulled the whole row into server
    // memory — harmless in process, but it hides the intent, and a later edit
    // could be tempted to return the row it had already fetched.
    const db = createFakeSupabase();
    db.onTable('orders', { data: { id: 'order-1', branch_id: CALLER_BRANCH }, error: null });

    await assertRowBelongsToBranch(db.client, { ...baseOptions, branchId: CALLER_BRANCH });

    const call = db.lastCall('orders', 'select');
    assert.equal(call?.columns, 'id, branch_id');
    assert.deepEqual(FakeSupabase.filtersOf(call, 'eq'), [['id', 'order-1']]);
    assert.deepEqual(call?.modes, ['maybeSingle']);
  });

  it('refuses another branch’s row with a 404, not a 403', async () => {
    /*
     * The refusal must be indistinguishable from "no such row". A 403 on an id
     * that exists and a 404 on one that does not would let a caller enumerate the
     * other branch — probe a uuid, read the status, learn whether that customer
     * or stock item exists in the shop they cannot see. For a customer, existence
     * is itself business information.
     */
    const db = createFakeSupabase();
    db.onTable('orders', { data: { id: 'order-1', branch_id: OTHER_BRANCH }, error: null });

    await assertAppError(
      () => assertRowBelongsToBranch(db.client, { ...baseOptions, branchId: CALLER_BRANCH }),
      404,
      'ORDER_NOT_FOUND',
    );
  });

  it('writes a server-side warning when refusing another branch, so support can see it', async () => {
    /*
     * The other half of the 404 decision. The plan asked for a *clear* failure
     * because a silent one "hides bugs and makes support impossible" — and that
     * concern is answered here rather than in the status code. If no warning is
     * written, this test passes only because the line above it threw; that is the
     * point: the two tests are the two halves of one contract.
     */
    const db = createFakeSupabase();
    db.onTable('orders', { data: { id: 'order-1', branch_id: OTHER_BRANCH }, error: null });

    const warnings: string[] = [];
    const originalWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: unknown) => {
      warnings.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;

    try {
      await assertAppError(
        () => assertRowBelongsToBranch(db.client, { ...baseOptions, branchId: CALLER_BRANCH }),
        404,
        'ORDER_NOT_FOUND',
      );
    } finally {
      process.stderr.write = originalWrite;
    }

    const refusal = warnings.find((line) => line.includes('Cross-branch access refused'));
    assert.ok(refusal, `Expected a cross-branch warning, received: ${warnings.join('')}`);
    const entry = JSON.parse(refusal) as Record<string, unknown>;
    assert.equal(entry.level, 'warn');
    assert.equal(entry.entity, 'order');
    assert.equal(entry.table, 'orders');
    assert.equal(entry.id, 'order-1');
    assert.equal(entry.callerBranch, CALLER_BRANCH);
    assert.equal(entry.rowBranch, OTHER_BRANCH);
  });

  it('refuses a missing row with the same 404', async () => {
    const db = createFakeSupabase();
    db.onTable('orders', { data: null, error: null });

    await assertAppError(
      () => assertRowBelongsToBranch(db.client, { ...baseOptions, branchId: CALLER_BRANCH }),
      404,
      'ORDER_NOT_FOUND',
    );
  });

  it('reports a lookup failure as a 503, not a 404', async () => {
    /*
     * A transient database error must not be reported as "this record is gone".
     * That would be a wrong authorization decision made on no evidence, and it
     * would send support chasing a deletion that never happened. The code is
     * derived by stripping `_NOT_FOUND` and appending `_LOOKUP_FAILED`, so this
     * also pins that naming rule.
     */
    const db = createFakeSupabase();
    db.onTable('orders', { data: null, error: { message: 'connection reset' } });

    const error = await assertAppError(
      () => assertRowBelongsToBranch(db.client, { ...baseOptions, branchId: CALLER_BRANCH }),
      503,
      'ORDER_LOOKUP_FAILED',
    );
    assert.equal(error.message, 'The order could not be checked.');
  });

  it('treats a row with no branch as another branch’s, never as the caller’s', async () => {
    /*
     * A row whose `branch_id` is null is an anomaly — the column is `not null`,
     * so it can only mean a pre-migration row or a broken write. The comparison
     * is `!==`, so `null` never equals the caller's branch and the row is
     * refused. A `==` or a truthiness check would let it through, and an
     * unscoped row would be readable and writable by every branch at once.
     */
    const db = createFakeSupabase();
    db.onTable('orders', { data: { id: 'order-1', branch_id: null }, error: null });

    await assertAppError(
      () => assertRowBelongsToBranch(db.client, { ...baseOptions, branchId: CALLER_BRANCH }),
      404,
      'ORDER_NOT_FOUND',
    );
  });
});
