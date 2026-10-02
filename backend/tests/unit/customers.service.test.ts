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
 *
 * As of migration 20261002000300 a customer **belongs to a branch**, so every
 * read and write carries `branch_id`. These tests assert that narrowing on every
 * path: the branch is part of the lookup, not a filter applied to the result, so
 * a Balayan customer is not addressable from Nasugbu at all.
 */

const BRANCH = 'branch-balayan';

const CUSTOMER_ROW = {
  id: 'cust-1',
  name: 'Bright Star Printing',
  phone: '0917 111 2222',
  email: 'hello@brightstar.test',
  notes: '',
  branch_id: BRANCH,
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
      () => deleteCustomer(db.client, 'cust-1', BRANCH),
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

    await assertAppError(() => deleteCustomer(db.client, 'cust-1', BRANCH), 404, 'CUSTOMER_NOT_FOUND');
  });

  it('asks for the deleted rows back so the two cases can be told apart', async () => {
    const db = createFakeSupabase();
    db.queueTable('customers', { data: [{ id: 'cust-1' }], error: null });

    await deleteCustomer(db.client, 'cust-1', BRANCH);

    const call = lastDelete(db);
    assert.equal(call?.columns, 'id');
    assert.deepEqual(FakeSupabase.filtersOf(call, 'eq'), [
      ['id', 'cust-1'],
      ['branch_id', BRANCH],
    ]);
  });

  it('deletes without error when the row existed', async () => {
    const db = createFakeSupabase();
    db.queueTable('customers', { data: [{ id: 'cust-1' }], error: null });

    await assertResolves(() => deleteCustomer(db.client, 'cust-1', BRANCH));
  });

  it('narrows the delete to the caller\'s branch', async () => {
    // The predicate is what makes "not found" the answer for another branch's
    // customer, rather than a successful delete of the other shop's record.
    const db = createFakeSupabase();
    db.queueTable('customers', { data: [{ id: 'cust-1' }], error: null });

    await deleteCustomer(db.client, 'cust-1', BRANCH);

    assert.ok(FakeSupabase.hasFilter(lastDelete(db), 'eq', ['branch_id', BRANCH]));
  });
});

describe('countOrdersForCustomer', () => {
  it('returns the count without transferring any rows', async () => {
    const db = createFakeSupabase();
    db.queueTable('orders', { data: null, error: null, count: 7 });

    const count = await countOrdersForCustomer(db.client, 'cust-1', BRANCH);

    assert.equal(count, 7);
    const call = db.lastCall('orders', 'select');
    assert.deepEqual(call?.options, { count: 'exact', head: true });
    assert.deepEqual(FakeSupabase.filtersOf(call, 'eq'), [
      ['customer_id', 'cust-1'],
      ['branch_id', BRANCH],
    ]);
  });

  it('treats a missing count as zero', async () => {
    const db = createFakeSupabase();
    db.queueTable('orders', { data: null, error: null, count: null });

    assert.equal(await countOrdersForCustomer(db.client, 'cust-1', BRANCH), 0);
  });

  it('reports a failure rather than quietly answering zero', async () => {
    const db = createFakeSupabase();
    // Returning 0 here would let the delete dialog claim the customer has no
    // history when it simply could not find out.
    db.queueTable('orders', { data: null, error: DB_FAILURE, count: null });

    await assertAppError(() => countOrdersForCustomer(db.client, 'cust-1', BRANCH), 503, 'ORDER_COUNT_FAILED');
  });
});

describe('customer reads and writes', () => {
  it('separates a database failure from a missing customer when reading one', async () => {
    const db = createFakeSupabase();
    db.queueTable('customers', { data: null, error: DB_FAILURE });

    await assertAppError(() => getCustomer(db.client, 'cust-1', BRANCH), 503, 'CUSTOMERS_LOOKUP_FAILED');
  });

  it('reports a missing customer when reading one', async () => {
    const db = createFakeSupabase();
    db.queueTable('customers', { data: null, error: null });

    await assertAppError(() => getCustomer(db.client, 'cust-1', BRANCH), 404, 'CUSTOMER_NOT_FOUND');
  });

  it('looks the customer up by id **and** branch', async () => {
    // A guessed uuid belonging to Nasugbu must miss entirely for a Balayan
    // caller, which is only true if the branch is in the WHERE clause — a
    // filter applied after the read would still have fetched the row.
    const db = createFakeSupabase();
    db.queueTable('customers', { data: CUSTOMER_ROW, error: null });

    await getCustomer(db.client, 'cust-1', BRANCH);

    assert.deepEqual(FakeSupabase.filtersOf(db.lastCall('customers', 'select'), 'eq'), [
      ['id', 'cust-1'],
      ['branch_id', BRANCH],
    ]);
  });

  it('reports a failed create as an outage, not invalid details', async () => {
    const db = createFakeSupabase();
    db.queueTable('customers', { data: null, error: DB_FAILURE });

    await assertAppError(
      () => createCustomer(db.client, BRANCH, { name: 'Bright Star Printing' }),
      503,
      'CUSTOMER_CREATE_FAILED',
      'unavailable',
    );
  });

  it('creates a customer successfully', async () => {
    const db = createFakeSupabase();
    db.queueTable('customers', { data: CUSTOMER_ROW, error: null });

    const created = await createCustomer(db.client, BRANCH, { name: 'Bright Star Printing' });

    assert.equal(created.id, 'cust-1');
    assert.equal(created.name, 'Bright Star Printing');
  });

  it('files the new customer under the caller\'s branch, not the request body', async () => {
    // The column is `not null` with no default, so omitting it is not an option —
    // and it must not be something the client can choose. `createCustomer` takes
    // the branch as its own argument, so there is no path by which a body could
    // supply it.
    const db = createFakeSupabase();
    db.queueTable('customers', { data: CUSTOMER_ROW, error: null });

    await createCustomer(db.client, BRANCH, { name: 'Bright Star Printing' });

    const payload = db.lastCall('customers', 'insert')?.payload as Record<string, unknown>;
    assert.equal(payload.branch_id, BRANCH);
  });

  it('does not call an outage "not found" when updating', async () => {
    const db = createFakeSupabase();
    db.queueTable('customers', { data: null, error: DB_FAILURE });

    await assertAppError(
      () => updateCustomer(db.client, 'cust-1', BRANCH, { name: 'Bright Star Printing' }),
      503,
      'CUSTOMER_UPDATE_FAILED',
      'unavailable',
    );
  });

  it('reports a customer that vanished mid-edit as not found', async () => {
    const db = createFakeSupabase();
    db.queueTable('customers', { data: null, error: null });

    await assertAppError(
      () => updateCustomer(db.client, 'cust-1', BRANCH, { name: 'Bright Star Printing' }),
      404,
      'CUSTOMER_NOT_FOUND',
    );
  });

  it('scopes the update to the caller\'s branch', async () => {
    // This is what stops a Nasugbu staff member editing a Balayan customer by id:
    // the update matches no row, so it falls through to the 404 above.
    const db = createFakeSupabase();
    db.queueTable('customers', { data: CUSTOMER_ROW, error: null });

    await updateCustomer(db.client, 'cust-1', BRANCH, { name: 'Bright Star Printing' });

    assert.deepEqual(FakeSupabase.filtersOf(db.lastCall('customers', 'update'), 'eq'), [
      ['id', 'cust-1'],
      ['branch_id', BRANCH],
    ]);
  });
});
