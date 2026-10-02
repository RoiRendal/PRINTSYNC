import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createOrderPayment,
  deleteOrderPayment,
  listOrderPayments,
} from '../../src/modules/orderPayments/orderPayments.service.js';
import { assertAppError } from './helpers/assertAppError.js';
import { FakeSupabase, createFakeSupabase } from './helpers/fakeSupabase.js';

/*
 * Order payments, and the branch hole that was in here.
 *
 * `order_payments` has **no branch column**, and it should not have one: a
 * payment belongs to whichever branch owns its order, and the parent foreign key
 * is the single source of truth. That is a deliberate schema decision, and it is
 * also why this file was the easiest place in the system to leave a hole — there
 * is nothing on the row to filter by, so the branch has to be resolved through
 * the order first, and if a service forgets to, **nothing complains**.
 *
 * It forgot. Until this phase, `GET /order-payments/:orderId` returned any
 * order's payments to any authenticated caller holding `order_payments.read`,
 * `POST` attached a payment to any order id, and `DELETE` removed any payment by
 * id. The tests below exist so that cannot be silently reintroduced: each of the
 * three entry points is checked for the branch refusal *and* for the positive
 * case, because a service that refuses everything is broken in a way a
 * refusal-only test would call a pass.
 */

const CALLER_BRANCH = 'branch-balayan';
const OTHER_BRANCH = 'branch-nasugbu';
const ORDER_ID = 'order-1';

/** Registers the order lookup the service makes before touching payments. */
function withOrderIn(db: FakeSupabase, branchId: string): FakeSupabase {
  return db.onTable('orders', { data: { id: ORDER_ID, branch_id: branchId }, error: null });
}

describe('listOrderPayments', () => {
  it('returns the order’s payments in newest-first order', async () => {
    const db = withOrderIn(createFakeSupabase(), CALLER_BRANCH);
    db.onTable('order_payments', {
      data: [
        { id: 'pay-2', order_id: ORDER_ID, amount: 500, method: 'Cash', notes: '', created_by: 'u1', created_at: '2026-10-02T10:00:00Z' },
        { id: 'pay-1', order_id: ORDER_ID, amount: 250, method: 'Card', notes: 'deposit', created_by: 'u1', created_at: '2026-10-01T10:00:00Z' },
      ],
      error: null,
    });

    const payments = await listOrderPayments(db.client, ORDER_ID, CALLER_BRANCH);

    assert.deepEqual(payments.map((payment) => payment.id), ['pay-2', 'pay-1']);
    assert.equal(payments[0]?.method, 'Cash');
    assert.equal(payments[1]?.notes, 'deposit');
    assert.deepEqual(FakeSupabase.filtersOf(db.lastCall('order_payments', 'select'), 'eq'), [['order_id', ORDER_ID]]);
    assert.deepEqual(FakeSupabase.filtersOf(db.lastCall('order_payments', 'select'), 'order'), [
      ['created_at', { ascending: false }],
    ]);
  });

  it('refuses another branch’s order with a 404, and never reads its payments', async () => {
    /*
     * The second assertion is the important one. Without the order check the
     * service would run its payment query and return whatever the other branch's
     * order held — so a test that only checked the status would still pass if a
     * later refactor moved the check *after* the read. Asserting that
     * `order_payments` was never queried pins the ordering.
     */
    const db = withOrderIn(createFakeSupabase(), OTHER_BRANCH);

    await assertAppError(() => listOrderPayments(db.client, ORDER_ID, CALLER_BRANCH), 404, 'ORDER_NOT_FOUND');

    assert.equal(db.callsFor('order_payments').length, 0, 'payments must not be read before the order is checked');
  });

  it('refuses a non-existent order with the same 404', async () => {
    const db = createFakeSupabase();
    db.onTable('orders', { data: null, error: null });

    await assertAppError(() => listOrderPayments(db.client, ORDER_ID, CALLER_BRANCH), 404, 'ORDER_NOT_FOUND');
    assert.equal(db.callsFor('order_payments').length, 0);
  });

  it('reports a payment read failure as a 503', async () => {
    const db = withOrderIn(createFakeSupabase(), CALLER_BRANCH);
    db.onTable('order_payments', { data: null, error: { message: 'timeout' } });

    await assertAppError(() => listOrderPayments(db.client, ORDER_ID, CALLER_BRANCH), 503, 'ORDER_PAYMENTS_LOOKUP_FAILED');
  });
});

describe('createOrderPayment', () => {
  const input = { orderId: ORDER_ID, amount: 750, method: 'Cash' as const, notes: '  half  ' };

  it('records the payment against the caller’s own order, trimming notes', async () => {
    const db = withOrderIn(createFakeSupabase(), CALLER_BRANCH);
    db.onTable('order_payments', {
      data: { id: 'pay-9', order_id: ORDER_ID, amount: 750, method: 'Cash', notes: 'half', created_by: 'u1', created_at: '2026-10-02T10:00:00Z' },
      error: null,
    });

    const payment = await createOrderPayment(db.client, input, 'u1', CALLER_BRANCH);

    assert.equal(payment.id, 'pay-9');
    const insert = db.lastCall('order_payments', 'insert');
    assert.deepEqual((insert?.payload as Record<string, unknown>).notes, 'half');
    assert.deepEqual((insert?.payload as Record<string, unknown>).created_by, 'u1');
  });

  it('refuses to attach a payment to another branch’s order, and writes nothing', async () => {
    /*
     * This is a WRITE against another branch's books when the guard is absent.
     * The payload carries `order_id`, so nothing about the request body says
     * which branch is intended — the check is the only thing standing between a
     * Balayan cashier and a Nasugbu order.
     */
    const db = withOrderIn(createFakeSupabase(), OTHER_BRANCH);

    await assertAppError(() => createOrderPayment(db.client, input, 'u1', CALLER_BRANCH), 404, 'ORDER_NOT_FOUND');

    assert.equal(db.callsFor('order_payments', 'insert').length, 0, 'no payment may be written without the order check');
  });

  it('refuses a payment for an order that does not exist', async () => {
    const db = createFakeSupabase();
    db.onTable('orders', { data: null, error: null });

    await assertAppError(() => createOrderPayment(db.client, input, 'u1', CALLER_BRANCH), 404, 'ORDER_NOT_FOUND');
    assert.equal(db.callsFor('order_payments', 'insert').length, 0);
  });
});

describe('deleteOrderPayment', () => {
  it('deletes a payment once its parent order is confirmed to be the caller’s', async () => {
    const db = withOrderIn(createFakeSupabase(), CALLER_BRANCH);
    // First read: the payment row, to learn its `order_id`. Second: the delete.
    db.queueTable(
      'order_payments',
      { data: { id: 'pay-1', order_id: ORDER_ID }, error: null },
      { data: null, error: null },
    );

    await deleteOrderPayment(db.client, 'pay-1', CALLER_BRANCH);

    const removed = db.callsFor('order_payments', 'delete');
    assert.equal(removed.length, 1);
    assert.deepEqual(FakeSupabase.filtersOf(removed[0], 'eq'), [['id', 'pay-1']]);
  });

  it('resolves the branch through the parent order, since the payment has no branch of its own', async () => {
    /*
     * A delete arrives with the *payment's* id, which says nothing about the
     * branch. The row's `order_id` is the bridge, and this asserts the service
     * actually crosses it rather than comparing the payment id to the branch or
     * skipping the check.
     */
    const db = withOrderIn(createFakeSupabase(), CALLER_BRANCH);
    db.queueTable(
      'order_payments',
      { data: { id: 'pay-1', order_id: ORDER_ID }, error: null },
      { data: null, error: null },
    );

    await deleteOrderPayment(db.client, 'pay-1', CALLER_BRANCH);

    assert.deepEqual(FakeSupabase.filtersOf(db.lastCall('orders', 'select'), 'eq'), [['id', ORDER_ID]]);
  });

  it('refuses to delete a payment on another branch’s order, and deletes nothing', async () => {
    const db = withOrderIn(createFakeSupabase(), OTHER_BRANCH);
    db.queueTable('order_payments', { data: { id: 'pay-1', order_id: ORDER_ID }, error: null });

    await assertAppError(() => deleteOrderPayment(db.client, 'pay-1', CALLER_BRANCH), 404, 'ORDER_NOT_FOUND');

    assert.equal(db.callsFor('order_payments', 'delete').length, 0, 'no payment may be deleted without the order check');
  });

  it('returns 404 for a payment that does not exist', async () => {
    const db = createFakeSupabase();
    db.queueTable('order_payments', { data: null, error: null });

    await assertAppError(() => deleteOrderPayment(db.client, 'missing', CALLER_BRANCH), 404, 'ORDER_PAYMENT_NOT_FOUND');
    // The order lookup must not even happen for a row that is not there.
    assert.equal(db.callsFor('orders').length, 0);
  });

  it('reports a payment lookup failure as a 503', async () => {
    const db = createFakeSupabase();
    db.queueTable('order_payments', { data: null, error: { message: 'connection reset' } });

    await assertAppError(() => deleteOrderPayment(db.client, 'pay-1', CALLER_BRANCH), 503, 'ORDER_PAYMENT_LOOKUP_FAILED');
  });

  it('reports a delete failure as a 400', async () => {
    const db = withOrderIn(createFakeSupabase(), CALLER_BRANCH);
    db.queueTable(
      'order_payments',
      { data: { id: 'pay-1', order_id: ORDER_ID }, error: null },
      { data: null, error: { message: 'foreign key violation' } },
    );

    await assertAppError(() => deleteOrderPayment(db.client, 'pay-1', CALLER_BRANCH), 400, 'ORDER_PAYMENT_DELETE_FAILED');
  });
});
