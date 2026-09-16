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

const ORDER_ROW = {
  id: 'order-1',
  customer: 'Acme Print Co',
  customer_id: 'customer-1',
  due_date: '2026-09-30',
  status: 'In Production',
  amount: 500,
  notes: 'Rush job',
  is_custom: true,
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

describe('orders.service', () => {
  describe('listOrders', () => {
    it('maps joined rows into a domain order record', async () => {
      const db = createFakeSupabase();
      queueOrderList(db, [ORDER_ROW]);

      const [order] = (await listOrders(db.client, { page: 1, limit: 20 })).data;

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
      assert.deepEqual(order.lineItems, [
        { itemId: 'inv-1', designId: undefined, name: 'Banner', quantity: 2, unitPrice: 150 },
        { itemId: undefined, designId: 'design-1', name: 'Sticker', quantity: 3, unitPrice: 50 },
      ] satisfies OrderLineItem[]);
    });

    it('translates page/limit into an inclusive Supabase range', async () => {
      const db = createFakeSupabase();
      queueOrderList(db, [ORDER_ROW]);

      await listOrders(db.client, { page: 3, limit: 10 });

      assert.deepEqual(FakeSupabase.filterOf(db.callsFor('orders')[0], 'range'), [20, 29]);
    });

    it('returns the pagination envelope with the exact row count', async () => {
      const db = createFakeSupabase();
      queueOrderList(db, [ORDER_ROW]);

      const response = await listOrders(db.client, { page: 2, limit: 5 });

      assert.equal(response.total, 1);
      assert.equal(response.page, 2);
      assert.equal(response.limit, 5);
      assert.equal(response.data.length, 1);
    });

    it('treats a null count as zero rather than NaN', async () => {
      const db = createFakeSupabase();
      db.queueTable('orders', { data: [], error: null, count: null });

      const response = await listOrders(db.client, { page: 1, limit: 20 });

      assert.equal(response.total, 0);
    });

    it('skips the item and payment lookups when the page is empty', async () => {
      const db = createFakeSupabase();
      db.queueTable('orders', { data: [], error: null, count: 0 });

      const response = await listOrders(db.client, { page: 1, limit: 20 });

      assert.deepEqual(response.data, []);
      assert.equal(db.callsFor('order_items').length, 0);
      assert.equal(db.callsFor('order_payments').length, 0);
    });

    it('maps a lookup failure to a 503 ORDERS_LOOKUP_FAILED', async () => {
      const db = createFakeSupabase();
      db.queueTable('orders', { data: null, error: { message: 'connection reset' } });

      await assertAppError(() => listOrders(db.client, { page: 1, limit: 20 }), 503, 'ORDERS_LOOKUP_FAILED');
    });

    it('maps a line item lookup failure to a 503', async () => {
      const db = createFakeSupabase();
      db.queueTable('orders', { data: [ORDER_ROW], error: null, count: 1 });
      db.queueTable('order_items', { data: null, error: { message: 'boom' } });
      db.queueTable('order_payments', { data: [], error: null });

      await assertAppError(() => listOrders(db.client, { page: 1, limit: 20 }), 503, 'ORDER_ITEMS_LOOKUP_FAILED');
    });
  });

  describe('getOrder', () => {
    it('returns the mapped order for an existing id', async () => {
      const db = createFakeSupabase();
      queueOrderSingle(db);

      const order = await getOrder(db.client, 'order-1');

      assert.equal(order.id, 'order-1');
      assert.equal(order.balanceDue, 250);
    });

    it('raises 404 ORDER_NOT_FOUND when no row matches', async () => {
      const db = createFakeSupabase();
      db.queueTable('orders', { data: null, error: null });

      await assertAppError(() => getOrder(db.client, 'missing'), 404, 'ORDER_NOT_FOUND');
    });

    it('leaves balanceDue at zero when payments exceed the order amount', async () => {
      const db = createFakeSupabase();
      db.queueTable('orders', { data: ORDER_ROW, error: null });
      queueOrderChildren(db, ITEM_ROWS, [{ order_id: 'order-1', amount: 900 }]);

      const order = await getOrder(db.client, 'order-1');

      assert.equal(order.totalPaid, 900);
      assert.equal(order.balanceDue, 0);
    });
  });

  describe('createOrder', () => {
    it('applies defaults and forwards the actor to the create RPC', async () => {
      const db = createFakeSupabase();
      db.queueRpc('create_order_with_items', { data: { id: 'order-1' } });
      queueOrderSingle(db);

      const order = await createOrder(
        db.client,
        { customer: 'Acme Print Co', lineItems: [{ name: 'Banner', quantity: 1, unitPrice: 10 }], amount: 10 },
        'actor-1',
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
    });

    it('surfaces the database error message when creation fails', async () => {
      const db = createFakeSupabase();
      db.queueRpc('create_order_with_items', { data: null, error: { message: 'insufficient stock' } });

      await assertAppError(
        () =>
          createOrder(
            db.client,
            { customer: 'Acme', lineItems: [{ name: 'Banner', quantity: 1, unitPrice: 1 }], amount: 1 },
            'actor-1',
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
      db.queueRpc('replace_order_with_items', { data: { id: 'order-1' } });
      // Second read: the refreshed order after the RPC.
      queueOrderSingle(db);

      await updateOrder(
        db.client,
        'order-1',
        { lineItems: [{ name: 'Poster', quantity: 1, unitPrice: 20 }] },
        'actor-1',
        version,
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
    });

    it('maps a lost race on the RPC path to a 409 carrying both versions', async () => {
      const db = createFakeSupabase();
      queueOrderSingle(db);
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
            { lineItems: [{ name: 'Poster', quantity: 1, unitPrice: 20 }] },
            'actor-1',
            version,
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

      await updateOrder(db.client, 'order-1', { status: 'Completed', notes: 'Done' }, 'actor-1', version);

      const update = db.lastCall('orders', 'update');
      assert.equal(update?.kind, 'update');
      assert.deepEqual(update?.payload, { status: 'Completed', notes: 'Done' });
      // The version rides in the WHERE clause, which is what makes this path a
      // compare-and-swap rather than a blind overwrite.
      assert.deepEqual(update?.filters.filter((filter) => filter.method === 'eq'), [
        { method: 'eq', args: ['id', 'order-1'] },
        { method: 'eq', args: ['updated_at', version] },
      ]);
      // The line-item RPC must not be involved in a scalar patch.
      assert.equal(db.callsFor('replace_order_with_items').length, 0);
    });

    it('converts camelCase input to snake_case columns', async () => {
      const db = createFakeSupabase();
      db.queueTable('orders', { data: ORDER_ROW, error: null });
      queueOrderSingle(db);

      await updateOrder(db.client, 'order-1', { customerId: 'customer-2', dueDate: '2026-10-01', isCustom: false }, 'actor-1', version);

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

      await updateOrder(db.client, 'order-1', { customerId: undefined, dueDate: undefined }, 'actor-1', version);

      // `undefined` means "not supplied" in the update type, so nothing is sent.
      assert.deepEqual(db.lastCall('orders', 'update')?.payload, {});
    });

    it('raises 404 when the order to patch does not exist', async () => {
      const db = createFakeSupabase();
      // The update matches nothing, and the follow-up lookup confirms it is gone.
      db.queueTable('orders', { data: null, error: null }, { data: null, error: null });

      await assertAppError(
        () => updateOrder(db.client, 'missing', { status: 'Completed' }, 'actor-1', version),
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
        () => updateOrder(db.client, 'order-1', { status: 'Completed' }, 'actor-1', version),
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
    it('delegates to the delete RPC with the actor', async () => {
      const db = createFakeSupabase();
      db.queueRpc('delete_order_with_items', { data: { id: 'order-1' } });

      await deleteOrder(db.client, 'order-1', 'actor-1');

      const rpcPayload = db.lastCall('delete_order_with_items')?.payload as Record<string, unknown>;
      assert.equal(rpcPayload.p_order_id, 'order-1');
      assert.equal(rpcPayload.p_actor_id, 'actor-1');
    });

    it('raises 404 ORDER_DELETE_FAILED with the RPC message', async () => {
      const db = createFakeSupabase();
      db.queueRpc('delete_order_with_items', { data: null, error: { message: 'order is locked' } });

      await assertAppError(() => deleteOrder(db.client, 'order-1', 'actor-1'), 404, 'ORDER_DELETE_FAILED', 'order is locked');
    });
  });

  describe('exportOrders', () => {
    it('reads every order without applying a range', async () => {
      const db = createFakeSupabase();
      queueOrderList(db, [ORDER_ROW]);

      const orders = await exportOrders(db.client);

      assert.equal(orders.length, 1);
      assert.equal(FakeSupabase.filterOf(db.callsFor('orders')[0], 'range'), undefined);
    });

    it('maps a lookup failure to a 503', async () => {
      const db = createFakeSupabase();
      db.queueTable('orders', { data: null, error: { message: 'down' } });

      await assertAppError(() => exportOrders(db.client), 503, 'ORDERS_LOOKUP_FAILED');
    });
  });
});
