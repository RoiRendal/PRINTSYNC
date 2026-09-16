import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createTransaction,
  exportTransactions,
  getTransaction,
  listTransactions,
  voidTransaction,
  type TransactionInput,
} from '../../src/modules/payments/payments.service.js';
import { createFakeSupabase, FakeSupabase } from './helpers/fakeSupabase.js';
import { assertAppError } from './helpers/assertAppError.js';

const TRANSACTION_ROW = {
  id: 'txn-1',
  status: 'completed',
  subtotal: 200,
  discount: 20,
  tax: 24,
  total: 204,
  payment_method: 'Cash',
  created_at: '2026-09-15T09:15:00.000Z',
};

const ITEM_ROWS = [
  { transaction_id: 'txn-1', inventory_item_id: 'inv-1', name: 'Glossy Paper', quantity: 2, unit_price: 100 },
];

const PAYMENT_ROWS = [{ transaction_id: 'txn-1', amount: 204 }];

/** Both child lookups run under `Promise.all`, so each needs a response. */
function queueTransactionChildren(
  db: FakeSupabase,
  items: Record<string, unknown>[] = ITEM_ROWS,
  payments: Record<string, unknown>[] = PAYMENT_ROWS,
): void {
  db.queueTable('sales_transaction_items', { data: items, error: null });
  db.queueTable('payments', { data: payments, error: null });
}

function queueTransactionList(db: FakeSupabase, rows: Record<string, unknown>[], count = rows.length): void {
  db.queueTable('sales_transactions', { data: rows, error: null, count });
  queueTransactionChildren(db);
}

function queueTransactionSingle(db: FakeSupabase, row: Record<string, unknown> | null = TRANSACTION_ROW): void {
  db.queueTable('sales_transactions', { data: row, error: null });
  queueTransactionChildren(db);
}

describe('payments.service', () => {
  describe('listTransactions', () => {
    it('maps rows and joins line items with captured payments', async () => {
      const db = createFakeSupabase();
      queueTransactionList(db, [TRANSACTION_ROW]);

      const [transaction] = (await listTransactions(db.client, { page: 1, limit: 20 })).data;

      assert.ok(transaction);
      assert.equal(transaction.id, 'txn-1');
      assert.equal(transaction.status, 'completed');
      assert.equal(transaction.subtotal, 200);
      assert.equal(transaction.discount, 20);
      assert.equal(transaction.tax, 24);
      assert.equal(transaction.total, 204);
      assert.equal(transaction.paymentMethod, 'Cash');
      assert.equal(transaction.paymentAmount, 204);
      assert.equal(transaction.date, '2026-09-15');
      assert.deepEqual(transaction.items, [
        { itemId: 'inv-1', name: 'Glossy Paper', quantity: 2, unitPrice: 100 },
      ]);
    });

    it('only sums captured payments', async () => {
      const db = createFakeSupabase();
      db.queueTable('sales_transactions', { data: [TRANSACTION_ROW], error: null, count: 1 });
      queueTransactionChildren(db);

      await listTransactions(db.client, { page: 1, limit: 20 });

      assert.deepEqual(FakeSupabase.filterOf(db.callsFor('payments')[0], 'eq'), ['status', 'captured']);
    });

    it('defaults paymentAmount to zero when no captured payment exists', async () => {
      const db = createFakeSupabase();
      db.queueTable('sales_transactions', { data: [TRANSACTION_ROW], error: null, count: 1 });
      queueTransactionChildren(db, ITEM_ROWS, []);

      const [transaction] = (await listTransactions(db.client, { page: 1, limit: 20 })).data;

      assert.ok(transaction);
      assert.equal(transaction.paymentAmount, 0);
    });

    it('translates page/limit into an inclusive range', async () => {
      const db = createFakeSupabase();
      queueTransactionList(db, []);

      await listTransactions(db.client, { page: 4, limit: 15 });

      assert.deepEqual(FakeSupabase.filterOf(db.callsFor('sales_transactions')[0], 'range'), [45, 59]);
    });

    it('skips child lookups for an empty page', async () => {
      const db = createFakeSupabase();
      db.queueTable('sales_transactions', { data: [], error: null, count: 0 });

      const response = await listTransactions(db.client, { page: 1, limit: 20 });

      assert.deepEqual(response.data, []);
      assert.equal(db.callsFor('sales_transaction_items').length, 0);
      assert.equal(db.callsFor('payments').length, 0);
    });

    it('maps a lookup failure to a 503 TRANSACTIONS_LOOKUP_FAILED', async () => {
      const db = createFakeSupabase();
      db.queueTable('sales_transactions', { data: null, error: { message: 'timeout' } });

      await assertAppError(() => listTransactions(db.client, { page: 1, limit: 20 }), 503, 'TRANSACTIONS_LOOKUP_FAILED');
    });

    it('maps a payment lookup failure to a 503 PAYMENTS_LOOKUP_FAILED', async () => {
      const db = createFakeSupabase();
      db.queueTable('sales_transactions', { data: [TRANSACTION_ROW], error: null, count: 1 });
      db.queueTable('sales_transaction_items', { data: ITEM_ROWS, error: null });
      db.queueTable('payments', { data: null, error: { message: 'boom' } });

      await assertAppError(() => listTransactions(db.client, { page: 1, limit: 20 }), 503, 'PAYMENTS_LOOKUP_FAILED');
    });
  });

  describe('getTransaction', () => {
    it('returns the mapped transaction', async () => {
      const db = createFakeSupabase();
      queueTransactionSingle(db);

      const transaction = await getTransaction(db.client, 'txn-1');

      assert.equal(transaction.id, 'txn-1');
      assert.equal(transaction.paymentAmount, 204);
    });

    it('raises 404 TRANSACTION_NOT_FOUND when no row matches', async () => {
      const db = createFakeSupabase();
      db.queueTable('sales_transactions', { data: null, error: null });

      await assertAppError(() => getTransaction(db.client, 'missing'), 404, 'TRANSACTION_NOT_FOUND');
    });
  });

  describe('createTransaction', () => {
    const baseInput: TransactionInput = {
      items: [{ name: 'Glossy Paper', quantity: 2, unitPrice: 100 }],
      subtotal: 200,
      discount: 20,
      tax: 24,
      total: 204,
      paymentMethod: 'Cash',
      paymentAmount: 250,
      idempotencyKey: 'a1b2c3d4-0000-4000-8000-000000000000',
    };

    it('forwards totals, payment method, actor and idempotency key to the create RPC', async () => {
      const db = createFakeSupabase();
      db.queueRpc('create_transaction_with_payment', { data: { id: 'txn-1' } });
      queueTransactionSingle(db);

      const transaction = await createTransaction(db.client, baseInput, 'actor-1');

      const payload = db.lastCall('create_transaction_with_payment')?.payload as Record<string, unknown>;
      assert.equal(payload.p_subtotal, 200);
      assert.equal(payload.p_discount, 20);
      assert.equal(payload.p_tax, 24);
      assert.equal(payload.p_total, 204);
      assert.equal(payload.p_payment_method, 'Cash');
      assert.equal(payload.p_received_amount, 250);
      assert.equal(payload.p_created_by, 'actor-1');
      assert.equal(payload.p_idempotency_key, baseInput.idempotencyKey);
      assert.equal(transaction.id, 'txn-1');
    });

    it('surfaces the database message when creation fails', async () => {
      const db = createFakeSupabase();
      db.queueRpc('create_transaction_with_payment', { data: null, error: { message: 'totals do not match items' } });

      await assertAppError(
        () => createTransaction(db.client, { ...baseInput, subtotal: 999, total: 999 }, 'actor-1'),
        400,
        'TRANSACTION_CREATE_FAILED',
        'totals do not match items',
      );
    });

    it('turns a structured stock shortfall into a 409 carrying the numbers', async () => {
      const db = createFakeSupabase();
      db.queueRpc('create_transaction_with_payment', {
        data: null,
        error: {
          message: 'Only 1 left in stock for "Glossy Paper" (2 requested).',
          details: JSON.stringify({ itemId: 'inv-1', itemName: 'Glossy Paper', available: 1, requested: 2 }),
        },
      });

      const error = await assertAppError(
        () => createTransaction(db.client, baseInput, 'actor-1'),
        409,
        'INSUFFICIENT_STOCK',
      );

      // The POS points at the offending cart line from this, so the shape matters
      // as much as the status code.
      assert.deepEqual(error.details, { itemId: 'inv-1', itemName: 'Glossy Paper', available: 1, requested: 2 });
    });

    it('does not mistake a foreign `details` value for a stock shortfall', async () => {
      const db = createFakeSupabase();
      // Postgres puts constraint names in `details` too; only our own JSON payload
      // should be read as structured context.
      db.queueRpc('create_transaction_with_payment', {
        data: null,
        error: { message: 'duplicate key value violates unique constraint', details: 'sales_transactions_pkey' },
      });

      const error = await assertAppError(
        () => createTransaction(db.client, baseInput, 'actor-1'),
        400,
        'TRANSACTION_CREATE_FAILED',
      );

      assert.equal(error.details, undefined);
    });
  });

  describe('voidTransaction', () => {
    it('voids through the RPC and returns the refreshed transaction', async () => {
      const db = createFakeSupabase();
      db.queueRpc('void_transaction', { data: { id: 'txn-1' } });
      db.queueTable('sales_transactions', { data: { ...TRANSACTION_ROW, status: 'voided' }, error: null });
      queueTransactionChildren(db);

      const transaction = await voidTransaction(db.client, 'txn-1', 'actor-1');

      const payload = db.lastCall('void_transaction')?.payload as Record<string, unknown>;
      assert.equal(payload.p_transaction_id, 'txn-1');
      assert.equal(payload.p_voided_by, 'actor-1');
      assert.equal(transaction.status, 'voided');
    });

    it('maps a void failure to a 400 TRANSACTION_VOID_FAILED', async () => {
      const db = createFakeSupabase();
      db.queueRpc('void_transaction', { data: null, error: { message: 'already voided' } });

      await assertAppError(() => voidTransaction(db.client, 'txn-1', 'actor-1'), 400, 'TRANSACTION_VOID_FAILED', 'already voided');
    });
  });

  describe('exportTransactions', () => {
    it('reads the whole table without a range', async () => {
      const db = createFakeSupabase();
      queueTransactionList(db, [TRANSACTION_ROW]);

      const transactions = await exportTransactions(db.client);

      assert.equal(transactions.length, 1);
      assert.equal(FakeSupabase.filterOf(db.callsFor('sales_transactions')[0], 'range'), undefined);
    });

    it('maps a lookup failure to a 503', async () => {
      const db = createFakeSupabase();
      db.queueTable('sales_transactions', { data: null, error: { message: 'down' } });

      await assertAppError(() => exportTransactions(db.client), 503, 'TRANSACTIONS_LOOKUP_FAILED');
    });
  });
});
