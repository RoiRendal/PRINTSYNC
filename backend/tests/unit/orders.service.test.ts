import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createOrder,
  deleteOrder,
  exportOrders,
  getOrder,
  listOrders,
  updateOrder,
  type OrderLineItem,
} from '../../src/modules/orders/orders.service.js';
import { createFakeSupabase, FakeSupabase } from './helpers/fakeSupabase.js';
import { assertAppError } from './helpers/assertAppError.js';
import { runWithRequestContext } from '../../src/shared/requestContext.js';

/**
 * A request as `middleware/requestId.ts` would have established it.
 *
 * The money RPCs write their own audit row, so these three values have to reach
 * them or the row is unattributable. `runWithRequestContext` is the real
 * mechanism, not a stand-in for it.
 */
const REQUEST_CONTEXT = {
  requestId: 'req-test-1',
  ipAddress: '203.0.113.9',
  userAgent: 'till/1.0',
};

/**
 * The branch every call is made as, and the branch every fixture row is filed
 * under. An order is owned by the branch that took it (migration
 * 20261002000300), so reads and writes carry `branch_id` and the `orders` table
 * is the only place it is stored — the line items and payments inherit it
 * through their parent and have no column of their own.
 */
const BRANCH = 'branch-balayan';

const ORDER_ROW = {
  id: 'order-1',
  customer: 'Acme Print Co',
  customer_id: 'customer-1',
  due_date: '2026-09-30',
  status: 'In Production',
  amount: 500,
  notes: 'Rush job',
  is_custom: true,
  branch_id: BRANCH,
  created_at: '2026-09-15T08:30:00.000Z',
  updated_at: '2026-09-15T08:30:00.000Z',
};

const ITEM_ROWS = [
  { order_id: 'order-1', inventory_item_id: 'inv-1', design_id: null, name: 'Banner', quantity: 2, unit_price: 150 },
  { order_id: 'order-1', inventory_item_id: null, design_id: 'design-1', name: 'Sticker', quantity: 3, unit_price: 50 },
];

const PAYMENT_ROWS = [
  { order_id: 'order-1', amount: 200 },
  { order_id: 'order-1', amount: 50 },
];

/**
 * Queues the child reads every order hydration performs. Both lookups are
 * issued with `Promise.all`, so a response must exist for each even when the
 * test only cares about one of them failing.
 */
function queueOrderChildren(
  db: FakeSupabase,
  items: Record<string, unknown>[] = ITEM_ROWS,
  payments: Record<string, unknown>[] = PAYMENT_ROWS,
): void {
  db.queueTable('order_items', { data: items, error: null });
  db.queueTable('order_payments', { data: payments, error: null });
}

/** Queues a paginated `orders` read (array result + count). */
function queueOrderList(db: FakeSupabase, rows: Record<string, unknown>[], count = rows.length): void {
  db.queueTable('orders', { data: rows, error: null, count });
  queueOrderChildren(db);
}

/** Queues a single-order read (`maybeSingle()` returns the row itself). */
function queueOrderSingle(db: FakeSupabase, row: Record<string, unknown> | null = ORDER_ROW): void {
  db.queueTable('orders', { data: row, error: null });
  queueOrderChildren(db);
}

/*
 * `getShopTimeZone` reads `business_settings` to decide which calendar day an
 * order's date is rendered in. Every hydration path now passes the caller's
 * branch, so the time-zone read is branch-scoped too — which means the fake must
 * answer it. The row below is the Balayan settings row.
 */
const SETTINGS_ROW = {
  branch_id: BRANCH,
  timezone: 'Asia/Manila',
  currency: 'PHP',
};

/** Queues the branch time-zone read every hydration performs. */
function queueShopTimeZone(db: FakeSupabase, timeZone: string = 'Asia/Manila'): void {
  db.queueTable('business_settings', { data: { ...SETTINGS_ROW, timezone: timeZone }, error: null });
}

describe('orders.service', () => {
  describe('listOrders', () => {
    it('maps joined rows into a domain order record', async () => {
      const db = createFakeSupabase();
      queueOrderList(db, [ORDER_ROW]);
      queueShopTimeZone(db);

      const [order] = (await listOrders(db.client, { page: 1, limit: 20 }, BRANCH)).data;

      assert.ok(order);
      assert.equal(order.id, 'order-1');
      assert.equal(order.customer, 'Acme Print Co');
      assert.equal(order.customerId, 'customer-1');
      assert.equal(order.dueDate, '2026-09-30');
      // `item` is a comma-joined summary of the line item names.
      assert.equal(order.item, 'Banner, Sticker');
      // quantity is the sum of line item quantities.
      assert.equal(order.quantity, 5);
      assert.equal(order.amount, 500);
      // totalPaid is the sum of every payment row for the order.
      assert.equal(order.totalPaid, 250);
      assert.equal(order.balanceDue, 250);
      assert.equal(order.designId, 'design-1');
      assert.equal(order.notes, 'Rush job');
      assert.equal(order.isCustom, true);
      assert.equal(order.date, '2026-09-15');
      // `lineDiscount` is now part of the line contract. The fixture rows carry
      // no `line_discount` column, which is the "row written before per-line
      // discounts existed" case, so the mapper must default it to 0 rather than
      // emit undefined.
      assert.deepEqual(order.lineItems, [
        { itemId: 'inv-1', designId: undefined, name: 'Banner', quantity: 2, unitPrice: 150, lineDiscount: 0 },
        { itemId: undefined, designId: 'design-1', name: 'Sticker', quantity: 3, unitPrice: 50, lineDiscount: 0 },
      ] satisfies OrderLineItem[]);
    });

    it('narrows the list to the caller\'s branch', async () => {
      // An order list is a shop's own book. Without the predicate the table
      // would mix both branches and `total` would count them together.
      const db = createFakeSupabase();
      queueOrderList(db, [ORDER_ROW]);
      queueShopTimeZone(db);

      await listOrders(db.client, { page: 1, limit: 20 }, BRANCH);

      assert.ok(FakeSupabase.hasFilter(db.callsFor('orders')[0], 'eq', ['branch_id', BRANCH]));
    });

    it('translates page/limit into an inclusive Supabase range', async () => {
      const db = createFakeSupabase();
      queueOrderList(db, [ORDER_ROW]);
      queueShopTimeZone(db);

      await listOrders(db.client, { page: 3, limit: 10 }, BRANCH);

      assert.deepEqual(FakeSupabase.filterOf(db.callsFor('orders')[0], 'range'), [20, 29]);
    });

    it('returns the pagination envelope with the exact row count', async () => {
      const db = createFakeSupabase();
      queueOrderList(db, [ORDER_ROW]);
      queueShopTimeZone(db);

      const response = await listOrders(db.client, { page: 2, limit: 5 }, BRANCH);

      assert.equal(response.total, 1);
      assert.equal(response.page, 2);
      assert.equal(response.limit, 5);
      assert.equal(response.data.length, 1);
    });

    it('filters by status in the query rather than in memory', async () => {
      const db = createFakeSupabase();
      queueOrderList(db, [ORDER_ROW]);
      queueShopTimeZone(db);

      await listOrders(db.client, { page: 1, limit: 20 }, BRANCH, 'Ready for Pickup');

      const call = db.callsFor('orders')[0];
      assert.deepEqual(FakeSupabase.filtersOf(call, 'eq'), [
        ['branch_id', BRANCH],
        ['status', 'Ready for Pickup'],
      ]);
    });

    it('sends no status filter when none was asked for', async () => {
      // The inverse bug: a filter applied unconditionally would hide orders from
      // every caller that never asked to filter, and the list would look broken
      // rather than over-eager. The branch filter is the only `.eq` expected.
      const db = createFakeSupabase();
      queueOrderList(db, [ORDER_ROW]);
      queueShopTimeZone(db);

      await listOrders(db.client, { page: 1, limit: 20 }, BRANCH);

      assert.deepEqual(FakeSupabase.filtersOf(db.callsFor('orders')[0], 'eq'), [['branch_id', BRANCH]]);
    });

    it('reports the filtered total, not the table total', async () => {
      // The fake returns whatever `count` is queued, standing in for what PostgREST
      // computes once the filter is applied. The assertion that matters is that the
      // service passes that number straight through instead of substituting its own.
      const db = createFakeSupabase();
      queueOrderList(db, [ORDER_ROW], 7);
      queueShopTimeZone(db);

      const response = await listOrders(db.client, { page: 1, limit: 20 }, BRANCH, 'Ready for Pickup');

      assert.equal(response.total, 7);
      assert.equal(response.data.length, 1);
    });

    it('still applies the range to a filtered query', async () => {
      // Filtering must not displace paging: a filtered list that always returned
      // page 1 would be a different bug with the same symptom.
      const db = createFakeSupabase();
      queueOrderList(db, [ORDER_ROW]);
      queueShopTimeZone(db);

      await listOrders(db.client, { page: 2, limit: 5 }, BRANCH, 'Pending');

      const call = db.callsFor('orders')[0];
      assert.ok(FakeSupabase.hasFilter(call, 'eq', ['status', 'Pending']));
      assert.deepEqual(FakeSupabase.filterOf(call, 'range'), [5, 9]);
    });

    it('treats a null count as zero rather than NaN', async () => {
      const db = createFakeSupabase();
      db.queueTable('orders', { data: [], error: null, count: null });

      const response = await listOrders(db.client, { page: 1, limit: 20 }, BRANCH);

      assert.equal(response.total, 0);
    });

    it('skips the item and payment lookups when the page is empty', async () => {
      const db = createFakeSupabase();
      db.queueTable('orders', { data: [], error: null, count: 0 });

      const response = await listOrders(db.client, { page: 1, limit: 20 }, BRANCH);

      assert.deepEqual(response.data, []);
      assert.equal(db.callsFor('order_items').length, 0);
      assert.equal(db.callsFor('order_payments').length, 0);
    });

    it('maps a lookup failure to a 503 ORDERS_LOOKUP_FAILED', async () => {
      const db = createFakeSupabase();
      db.queueTable('orders', { data: null, error: { message: 'connection reset' } });

      await assertAppError(() => listOrders(db.client, { page: 1, limit: 20 }, BRANCH), 503, 'ORDERS_LOOKUP_FAILED');
    });

    it('maps a line item lookup failure to a 503', async () => {
      const db = createFakeSupabase();
      db.queueTable('orders', { data: [ORDER_ROW], error: null, count: 1 });
      db.queueTable('order_items', { data: null, error: { message: 'boom' } });
      db.queueTable('order_payments', { data: [], error: null });

      await assertAppError(() => listOrders(db.client, { page: 1, limit: 20 }, BRANCH), 503, 'ORDER_ITEMS_LOOKUP_FAILED');
    });
  });

  describe('getOrder', () => {
    it('returns the mapped order for an existing id', async () => {
      const db = createFakeSupabase();
      queueOrderSingle(db);
      queueShopTimeZone(db);

      const order = await getOrder(db.client, 'order-1', BRANCH);

      assert.equal(order.id, 'order-1');
      assert.equal(order.balanceDue, 250);
    });

    it('raises 404 ORDER_NOT_FOUND when no row matches', async () => {
      const db = createFakeSupabase();
      db.queueTable('orders', { data: null, error: null });

      await assertAppError(() => getOrder(db.client, 'missing', BRANCH), 404, 'ORDER_NOT_FOUND');
    });

    it('looks the order up by id **and** branch when a branch is given', async () => {
      // The id-only arity is still reachable — the RPC wrappers call it after
      // writing the branch themselves — so the branch predicate being *applied
      // when supplied* is what makes a by-id fetch safe from a route.
      const db = createFakeSupabase();
      queueOrderSingle(db);
      queueShopTimeZone(db);

      await getOrder(db.client, 'order-1', BRANCH);

      assert.deepEqual(FakeSupabase.filtersOf(db.lastCall('orders', 'select'), 'eq'), [
        ['id', 'order-1'],
        ['branch_id', BRANCH],
      ]);
    });

    it('omits the branch predicate when no branch is given', async () => {
      // Preserved deliberately: this is the internal read called *after* an RPC
      // has just written the branch, and adding a second predicate there would
      // be a redundant condition rather than a protection.
      const db = createFakeSupabase();
      queueOrderSingle(db);
      queueShopTimeZone(db);

      await getOrder(db.client, 'order-1');

      assert.deepEqual(FakeSupabase.filtersOf(db.lastCall('orders', 'select'), 'eq'), [['id', 'order-1']]);
    });

    it('leaves balanceDue at zero when payments exceed the order amount', async () => {
      const db = createFakeSupabase();
      db.queueTable('orders', { data: ORDER_ROW, error: null });
      queueOrderChildren(db, ITEM_ROWS, [{ order_id: 'order-1', amount: 900 }]);
      queueShopTimeZone(db);

      const order = await getOrder(db.client, 'order-1', BRANCH);

      assert.equal(order.totalPaid, 900);
      assert.equal(order.balanceDue, 0);
    });
  });

  describe('createOrder', () => {
    it('applies defaults and forwards the actor to the create RPC', async () => {
      const db = createFakeSupabase();
      db.queueRpc('create_order_with_items', { data: { id: 'order-1' } });
      queueOrderSingle(db);
      queueShopTimeZone(db);

      const order = await createOrder(
        db.client,
        { customer: 'Acme Print Co', lineItems: [{ name: 'Banner', quantity: 1, unitPrice: 10, lineDiscount: 0 }], amount: 10 },
        'actor-1',
        BRANCH,
      );

      const rpcPayload = db.lastCall('create_order_with_items')?.payload as Record<string, unknown>;
      assert.equal(order.id, 'order-1');
      assert.equal(rpcPayload.p_customer, 'Acme Print Co');
      assert.equal(rpcPayload.p_status, 'Pending');
      assert.equal(rpcPayload.p_notes, '');
      assert.equal(rpcPayload.p_is_custom, false);
      assert.equal(rpcPayload.p_created_by, 'actor-1');
      assert.equal(rpcPayload.p_customer_id, null);
      assert.equal(rpcPayload.p_due_date, null);
      // The branch the order is filed under, and the branch whose stock it
      // reserves. Required by the RPC as of 20261002000400.
      assert.equal(rpcPayload.p_branch_id, BRANCH);
    });

    it('carries the request context into the create RPC, which audits from inside', async () => {
      const db = createFakeSupabase();
      db.queueRpc('create_order_with_items', { data: { id: 'order-1' } });
      queueOrderSingle(db);
      queueShopTimeZone(db);

      await runWithRequestContext(REQUEST_CONTEXT, () =>
        createOrder(
          db.client,
          { customer: 'Acme Print Co', lineItems: [{ name: 'Banner', quantity: 1, unitPrice: 10, lineDiscount: 0 }], amount: 10 },
          'actor-1',
          BRANCH,
        ),
      );

      const rpcPayload = db.lastCall('create_order_with_items')?.payload as Record<string, unknown>;
      assert.equal(rpcPayload.p_audit_request_id, 'req-test-1');
      assert.equal(rpcPayload.p_audit_ip_address, '203.0.113.9');
      assert.equal(rpcPayload.p_audit_user_agent, 'till/1.0');
    });

    it('sends nulls when there is no request, as for the seeder and the CLI', async () => {
      const db = createFakeSupabase();
      db.queueRpc('create_order_with_items', { data: { id: 'order-1' } });
      queueOrderSingle(db);
      queueShopTimeZone(db);

      await createOrder(
        db.client,
        { customer: 'Acme Print Co', lineItems: [{ name: 'Banner', quantity: 1, unitPrice: 10, lineDiscount: 0 }], amount: 10 },
        'actor-1',
        BRANCH,
      );

      const rpcPayload = db.lastCall('create_order_with_items')?.payload as Record<string, unknown>;
      assert.equal(rpcPayload.p_audit_request_id, null);
      assert.equal(rpcPayload.p_audit_ip_address, null);
      assert.equal(rpcPayload.p_audit_user_agent, null);
    });

    it('surfaces the database error message when creation fails', async () => {
      const db = createFakeSupabase();
      db.queueRpc('create_order_with_items', { data: null, error: { message: 'insufficient stock' } });

      await assertAppError(
        () =>
          createOrder(
            db.client,
            { customer: 'Acme', lineItems: [{ name: 'Banner', quantity: 1, unitPrice: 1, lineDiscount: 0 }], amount: 1 },
            'actor-1',
            BRANCH,
          ),
        400,
        'ORDER_CREATE_FAILED',
        'insufficient stock',
      );
    });
  });

  describe('updateOrder', () => {
    const version = ORDER_ROW.updated_at;

    it('replaces line items through the dedicated RPC, keeping unchanged fields', async () => {
      const db = createFakeSupabase();
      // First read: the existing order (updateOrder reads it to merge).
      queueOrderSingle(db);
      queueShopTimeZone(db);
      db.queueRpc('replace_order_with_items', { data: { id: 'order-1' } });
      // Second read: the refreshed order after the RPC.
      queueOrderSingle(db);

      await updateOrder(
        db.client,
        'order-1',
        { lineItems: [{ name: 'Poster', quantity: 1, unitPrice: 20, lineDiscount: 0 }] },
        'actor-1',
        version,
        BRANCH,
      );

      const rpcPayload = db.lastCall('replace_order_with_items')?.payload as Record<string, unknown>;
      assert.equal(rpcPayload.p_order_id, 'order-1');
      assert.equal(rpcPayload.p_actor_id, 'actor-1');
      // The version the editor loaded travels with the write, so the RPC can
      // refuse it if the order moved on.
      assert.equal(rpcPayload.p_expected_updated_at, version);
      // Values not supplied fall back to the existing order.
      assert.equal(rpcPayload.p_customer, 'Acme Print Co');
      assert.equal(rpcPayload.p_status, 'In Production');
      assert.equal(rpcPayload.p_amount, 500);
      assert.equal(rpcPayload.p_notes, 'Rush job');
      assert.equal(rpcPayload.p_is_custom, true);
      assert.equal(rpcPayload.p_customer_id, 'customer-1');
      assert.equal(rpcPayload.p_due_date, '2026-09-30');
      // The stock the replacement reserves is the caller's branch's.
      assert.equal(rpcPayload.p_branch_id, BRANCH);
    });

    it('carries the request context into the replace RPC, which audits the edit', async () => {
      const db = createFakeSupabase();
      // Read before the RPC to merge, and again after it to return the new version.
      queueOrderSingle(db);
      queueShopTimeZone(db);
      db.queueRpc('replace_order_with_items', { data: { id: 'order-1' } });
      queueOrderSingle(db);

      await runWithRequestContext(REQUEST_CONTEXT, () =>
        updateOrder(db.client, 'order-1', { lineItems: [{ name: 'Banner', quantity: 1, unitPrice: 10, lineDiscount: 0 }] }, 'actor-1', version, BRANCH),
      );

      const rpcPayload = db.lastCall('replace_order_with_items')?.payload as Record<string, unknown>;
      assert.equal(rpcPayload.p_audit_request_id, 'req-test-1');
      assert.equal(rpcPayload.p_audit_ip_address, '203.0.113.9');
      assert.equal(rpcPayload.p_audit_user_agent, 'till/1.0');
    });

    it('maps a lost race on the RPC path to a 409 carrying both versions', async () => {
      const db = createFakeSupabase();
      queueOrderSingle(db);
      queueShopTimeZone(db);
      db.queueRpc('replace_order_with_items', {
        data: null,
        error: {
          message: 'This order was changed by someone else while you were editing it.',
          details: JSON.stringify({
            orderId: 'order-1',
            expectedUpdatedAt: version,
            currentUpdatedAt: '2026-09-15T09:00:00.000Z',
          }),
        },
      });

      const error = await assertAppError(
        () =>
          updateOrder(
            db.client,
            'order-1',
            { lineItems: [{ name: 'Poster', quantity: 1, unitPrice: 20, lineDiscount: 0 }] },
            'actor-1',
            version,
            BRANCH,
          ),
        409,
        'ORDER_CONFLICT',
      );

      assert.deepEqual(error.details, {
        orderId: 'order-1',
        expectedUpdatedAt: version,
        currentUpdatedAt: '2026-09-15T09:00:00.000Z',
      });
    });

    it('patches scalar fields directly when no line items are supplied', async () => {
      const db = createFakeSupabase();
      db.queueTable('orders', { data: { ...ORDER_ROW, status: 'Completed' }, error: null });
      queueOrderSingle(db);
      queueShopTimeZone(db);

      await updateOrder(db.client, 'order-1', { status: 'Completed', notes: 'Done' }, 'actor-1', version, BRANCH);

      const update = db.lastCall('orders', 'update');
      assert.equal(update?.kind, 'update');
      assert.deepEqual(update?.payload, { status: 'Completed', notes: 'Done' });
      // The version rides in the WHERE clause, which is what makes this path a
      // compare-and-swap rather than a blind overwrite. The branch is the third
      // condition for the same reason it is everywhere else: an id from another
      // branch must not match.
      assert.deepEqual(update?.filters.filter((filter) => filter.method === 'eq'), [
        { method: 'eq', args: ['id', 'order-1'] },
        { method: 'eq', args: ['branch_id', BRANCH] },
        { method: 'eq', args: ['updated_at', version] },
      ]);
      // The line-item RPC must not be involved in a scalar patch.
      assert.equal(db.callsFor('replace_order_with_items').length, 0);
    });

    it('converts camelCase input to snake_case columns', async () => {
      const db = createFakeSupabase();
      db.queueTable('orders', { data: ORDER_ROW, error: null });
      queueOrderSingle(db);
      queueShopTimeZone(db);

      await updateOrder(db.client, 'order-1', { customerId: 'customer-2', dueDate: '2026-10-01', isCustom: false }, 'actor-1', version, BRANCH);

      assert.deepEqual(db.lastCall('orders', 'update')?.payload, {
        is_custom: false,
        customer_id: 'customer-2',
        due_date: '2026-10-01',
      });
    });

    it('writes null when optional relations are cleared', async () => {
      const db = createFakeSupabase();
      db.queueTable('orders', { data: ORDER_ROW, error: null });
      queueOrderSingle(db);
      queueShopTimeZone(db);

      await updateOrder(db.client, 'order-1', { customerId: undefined, dueDate: undefined }, 'actor-1', version, BRANCH);

      // `undefined` means "not supplied" in the update type, so nothing is sent.
      assert.deepEqual(db.lastCall('orders', 'update')?.payload, {});
    });

    it('raises 404 when the order to patch does not exist', async () => {
      const db = createFakeSupabase();
      // The update matches nothing, and the follow-up lookup confirms it is gone.
      db.queueTable('orders', { data: null, error: null }, { data: null, error: null });

      await assertAppError(
        () => updateOrder(db.client, 'missing', { status: 'Completed' }, 'actor-1', version, BRANCH),
        404,
        'ORDER_NOT_FOUND',
      );
    });

    it('reports a conflict, not a 404, when a scalar patch loses a race', async () => {
      const db = createFakeSupabase();
      // Nothing matched the compare-and-swap...
      db.queueTable('orders', { data: null, error: null });
      // ...but the order is still there, carrying a newer version.
      db.queueTable('orders', { data: { id: 'order-1', updated_at: '2026-09-15T09:00:00.000Z' }, error: null });

      const error = await assertAppError(
        () => updateOrder(db.client, 'order-1', { status: 'Completed' }, 'actor-1', version, BRANCH),
        409,
        'ORDER_CONFLICT',
      );

      assert.deepEqual(error.details, {
        orderId: 'order-1',
        expectedUpdatedAt: version,
        currentUpdatedAt: '2026-09-15T09:00:00.000Z',
      });
    });
  });

  describe('deleteOrder', () => {
    it('checks the order belongs to the caller\'s branch before deleting it', async () => {
      // `delete_order_with_items` deletes by id and takes no branch, so the
      // check has to happen here — and it is the one that matters most, because
      // after the RPC returns the row is gone.
      const db = createFakeSupabase();
      db.queueTable('orders', { data: { id: 'order-1' }, error: null });
      db.queueRpc('delete_order_with_items', { data: { id: 'order-1' } });

      await deleteOrder(db.client, 'order-1', 'actor-1', BRANCH);

      assert.deepEqual(FakeSupabase.filtersOf(db.lastCall('orders', 'select'), 'eq'), [
        ['id', 'order-1'],
        ['branch_id', BRANCH],
      ]);
    });

    it('refuses to delete an order outside the caller\'s branch', async () => {
      const db = createFakeSupabase();
      db.queueTable('orders', { data: null, error: null });
      db.queueRpc('delete_order_with_items', { data: { id: 'order-1' } });

      await assertAppError(() => deleteOrder(db.client, 'order-1', 'actor-1', BRANCH), 404, 'ORDER_NOT_FOUND');
      assert.equal(db.callsFor('delete_order_with_items').length, 0);
    });

    it('delegates to the delete RPC with the actor', async () => {
      const db = createFakeSupabase();
      db.queueTable('orders', { data: { id: 'order-1' }, error: null });
      db.queueRpc('delete_order_with_items', { data: { id: 'order-1' } });

      await deleteOrder(db.client, 'order-1', 'actor-1', BRANCH);

      const rpcPayload = db.lastCall('delete_order_with_items')?.payload as Record<string, unknown>;
      assert.equal(rpcPayload.p_order_id, 'order-1');
      assert.equal(rpcPayload.p_actor_id, 'actor-1');
    });

    it('raises 404 ORDER_DELETE_FAILED with the RPC message', async () => {
      const db = createFakeSupabase();
      db.queueTable('orders', { data: { id: 'order-1' }, error: null });
      db.queueRpc('delete_order_with_items', { data: null, error: { message: 'order is locked' } });

      await assertAppError(() => deleteOrder(db.client, 'order-1', 'actor-1', BRANCH), 404, 'ORDER_DELETE_FAILED', 'order is locked');
    });

    it('carries the request context into the delete RPC, so the last record of the order is attributable', async () => {
      // The order row is gone once this returns. If the audit row does not name the
      // request, nothing does.
      const db = createFakeSupabase();
      db.queueTable('orders', { data: { id: 'order-1' }, error: null });
      db.queueRpc('delete_order_with_items', { data: { id: 'order-1' } });

      await runWithRequestContext(REQUEST_CONTEXT, () => deleteOrder(db.client, 'order-1', 'actor-1', BRANCH));

      const rpcPayload = db.lastCall('delete_order_with_items')?.payload as Record<string, unknown>;
      assert.equal(rpcPayload.p_audit_request_id, 'req-test-1');
      assert.equal(rpcPayload.p_audit_ip_address, '203.0.113.9');
      assert.equal(rpcPayload.p_audit_user_agent, 'till/1.0');
    });
  });

  describe('exportOrders', () => {
    it('reads every order of the branch without applying a range', async () => {
      const db = createFakeSupabase();
      queueOrderList(db, [ORDER_ROW]);
      queueShopTimeZone(db);

      const orders = await exportOrders(db.client, BRANCH);

      assert.equal(orders.length, 1);
      assert.equal(FakeSupabase.filterOf(db.callsFor('orders')[0], 'range'), undefined);
      assert.ok(FakeSupabase.hasFilter(db.callsFor('orders')[0], 'eq', ['branch_id', BRANCH]));
    });

    it('maps a lookup failure to a 503', async () => {
      const db = createFakeSupabase();
      db.queueTable('orders', { data: null, error: { message: 'down' } });

      await assertAppError(() => exportOrders(db.client, BRANCH), 503, 'ORDERS_LOOKUP_FAILED');
    });
  });
});
