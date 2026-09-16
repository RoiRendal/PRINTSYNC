import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  countOrdersForCustomer,
  createCustomer,
  deleteCustomer,
  getCustomer,
  updateCustomer,
} from '../../src/modules/customers/customers.service.js';
import { createFakeSupabase, FakeSupabase } from './helpers/fakeSupabase.js';
import { assertAppError, assertResolves } from './helpers/assertAppError.js';

/*
 * The customer write paths used to answer a single generic 400 whatever went
 * wrong. That matters because the delete confirmation now warns staff how many
 * orders a customer has — a warning built on a count that silently reported zero
 * would be worse than no warning at all.
 *
 * `orders.customer_id` is `on delete set null`, so a customer with history is
 * never blocked; the count is advisory, and the delete is allowed through.
 */

const CUSTOMER_ROW = {
  id: 'cust-1',
  name: 'Bright Star Printing',
  phone: '0917 111 2222',
  email: 'hello@brightstar.test',
  notes: '',
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-10T00:00:00.000Z',
};

const DB_FAILURE = { message: 'connection terminated unexpectedly' };

function lastDelete(db: FakeSupabase) {
  return db.lastCall('customers', 'delete');
}

describe('deleteCustomer', () => {
  it('reports a database failure as an outage, not a rejection', async () => {
    const db = createFakeSupabase();
    db.queueTable('customers', { data: null, error: DB_FAILURE });

    await assertAppError(
      () => deleteCustomer(db.client, 'cust-1'),
      503,
      'CUSTOMER_DELETE_FAILED',
      'unavailable',
    );
  });

  it('reports a row that no longer exists as not found', async () => {
    const db = createFakeSupabase();
    // `.delete().select('id')` returns the deleted rows, so an empty array means
    // there was nothing to delete.
    db.queueTable('customers', { data: [], error: null });

    await assertAppError(() => deleteCustomer(db.client, 'cust-1'), 404, 'CUSTOMER_NOT_FOUND');
  });

  it('asks for the deleted rows back so the two cases can be told apart', async () => {
    const db = createFakeSupabase();
    db.queueTable('customers', { data: [{ id: 'cust-1' }], error: null });

    await deleteCustomer(db.client, 'cust-1');

    const call = lastDelete(db);
    assert.equal(call?.columns, 'id');
    assert.deepEqual(FakeSupabase.filterOf(call, 'eq'), ['id', 'cust-1']);
  });

  it('deletes without error when the row existed', async () => {
    const db = createFakeSupabase();
    db.queueTable('customers', { data: [{ id: 'cust-1' }], error: null });

    await assertResolves(() => deleteCustomer(db.client, 'cust-1'));
  });
});

describe('countOrdersForCustomer', () => {
  it('returns the count without transferring any rows', async () => {
    const db = createFakeSupabase();
    db.queueTable('orders', { data: null, error: null, count: 7 });

    const count = await countOrdersForCustomer(db.client, 'cust-1');

    assert.equal(count, 7);
    const call = db.lastCall('orders', 'select');
    assert.deepEqual(call?.options, { count: 'exact', head: true });
    assert.deepEqual(FakeSupabase.filterOf(call, 'eq'), ['customer_id', 'cust-1']);
  });

  it('treats a missing count as zero', async () => {
    const db = createFakeSupabase();
    db.queueTable('orders', { data: null, error: null, count: null });

    assert.equal(await countOrdersForCustomer(db.client, 'cust-1'), 0);
  });

  it('reports a failure rather than quietly answering zero', async () => {
    const db = createFakeSupabase();
    // Returning 0 here would let the delete dialog claim the customer has no
    // history when it simply could not find out.
    db.queueTable('orders', { data: null, error: DB_FAILURE, count: null });

    await assertAppError(() => countOrdersForCustomer(db.client, 'cust-1'), 503, 'ORDER_COUNT_FAILED');
  });
});

describe('customer reads and writes', () => {
  it('separates a database failure from a missing customer when reading one', async () => {
    const db = createFakeSupabase();
    db.queueTable('customers', { data: null, error: DB_FAILURE });

    await assertAppError(() => getCustomer(db.client, 'cust-1'), 503, 'CUSTOMERS_LOOKUP_FAILED');
  });

  it('reports a missing customer when reading one', async () => {
    const db = createFakeSupabase();
    db.queueTable('customers', { data: null, error: null });

    await assertAppError(() => getCustomer(db.client, 'cust-1'), 404, 'CUSTOMER_NOT_FOUND');
  });

  it('reports a failed create as an outage, not invalid details', async () => {
    const db = createFakeSupabase();
    db.queueTable('customers', { data: null, error: DB_FAILURE });

    await assertAppError(
      () => createCustomer(db.client, { name: 'Bright Star Printing' }),
      503,
      'CUSTOMER_CREATE_FAILED',
      'unavailable',
    );
  });

  it('creates a customer successfully', async () => {
    const db = createFakeSupabase();
    db.queueTable('customers', { data: CUSTOMER_ROW, error: null });

    const created = await createCustomer(db.client, { name: 'Bright Star Printing' });

    assert.equal(created.id, 'cust-1');
    assert.equal(created.name, 'Bright Star Printing');
  });

  it('does not call an outage "not found" when updating', async () => {
    const db = createFakeSupabase();
    db.queueTable('customers', { data: null, error: DB_FAILURE });

    await assertAppError(
      () => updateCustomer(db.client, 'cust-1', { name: 'Bright Star Printing' }),
      503,
      'CUSTOMER_UPDATE_FAILED',
      'unavailable',
    );
  });

  it('reports a customer that vanished mid-edit as not found', async () => {
    const db = createFakeSupabase();
    db.queueTable('customers', { data: null, error: null });

    await assertAppError(
      () => updateCustomer(db.client, 'cust-1', { name: 'Bright Star Printing' }),
      404,
      'CUSTOMER_NOT_FOUND',
    );
  });
});
