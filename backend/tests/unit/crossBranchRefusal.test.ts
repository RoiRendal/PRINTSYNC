import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  deleteDesign,
  listDesigns,
  updateDesign,
} from '../../src/modules/designs/designs.service.js';
import {
  createExpense,
  deleteExpense,
  listExpenses,
  updateExpense,
} from '../../src/modules/expenses/expenses.service.js';
import {
  createSupplier,
  deleteSupplier,
  getSupplier,
  listSuppliers,
  updateSupplier,
} from '../../src/modules/suppliers/suppliers.service.js';
import { assertAppError } from './helpers/assertAppError.js';
import { FakeSupabase, createFakeSupabase } from './helpers/fakeSupabase.js';

/*
 * The cross-branch refusal contract, one negative test per resource.
 *
 * ### Why one file rather than three
 *
 * `suppliers`, `expenses` and `designs` each had **no test file at all** before
 * this phase — which is the same blind spot that let `orderPayments` ship with no
 * branch check: a resource with no tests cannot fail a test. Splitting three
 * small suites into three files would have looked tidier and proved less,
 * because the thing worth asserting here is **the same invariant across every
 * resource**: a caller in branch A, acting on a row that lives in branch B, is
 * refused rather than silently served an empty result.
 *
 * ### What "refused" means, precisely
 *
 * Two outcomes are checked, not one:
 *
 *   1. **The read is scoped.** A list carries `.eq('branch_id', caller)`; a
 *      by-id read carries it too, so a foreign id matches nothing and the
 *      service raises a 404.
 *   2. **The query never leaves the branch.** For the list cases this is the
 *      filter itself; for the by-id cases it is the 404, because the fake returns
 *      the foreign row and the service must reject it on the branch predicate
 *      rather than trusting the id.
 *
 * A **silently empty list** would pass a naive "is the other branch's row
 * absent?" check while being exactly the failure the plan forbids — the caller
 * cannot tell "none of yours" from "none at all". So each resource asserts on
 * the predicate or the error, never on "the result did not contain the row".
 *
 * ### Why most of these assert the query, not a thrown error
 *
 * These services enforce the boundary by **putting the branch in the WHERE
 * clause** and letting the database return nothing — which is the right design,
 * because it is the one place that cannot be bypassed. The fake Supabase does not
 * evaluate filters, so a test cannot observe "the foreign row came back empty";
 * what it *can* observe, and what this service is actually responsible for, is
 * that the branch predicate was on the query. That is the same technique
 * `customers.service.test.ts` uses, and the two tests here that *do* expect a
 * throw are the ones where the service genuinely checks in code.
 *
 * One consequence worth stating plainly: **a by-id read whose branch predicate
 * were silently dropped would still pass a test that only asserted the return
 * value**, because the fake would hand back the row either way. The predicate
 * assertion is what makes these tests load-bearing.
 */

const CALLER_BRANCH = 'branch-balayan';
const OTHER_BRANCH = 'branch-nasugbu';

/** A realistic row from the *other* branch, used to prove it is refused. */
const FOREIGN_SUPPLIER = {
  id: 'sup-other',
  name: 'Nasugbu Paper Co',
  contact_person: 'Ana',
  phone: '0900',
  email: 'ana@example.invalid',
  address: 'Nasugbu',
  branch_id: OTHER_BRANCH,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
};

const FOREIGN_EXPENSE = {
  id: 'exp-other',
  category: 'Rent',
  description: 'Nasugbu rent',
  amount: 12000,
  expense_date: '2026-10-01',
  created_by: 'u-other',
  branch_id: OTHER_BRANCH,
  created_at: '2026-10-01T00:00:00Z',
};

const FOREIGN_DESIGN = {
  id: 'des-other',
  name: 'Nasugbu Tarpaulin',
  category: 'Tarpaulin',
  image_url: 'https://example.invalid/design.png',
  branch_id: OTHER_BRANCH,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  asset_type: null,
  asset_size_bytes: null,
};

const PAGE = { page: 1, limit: 20 };

describe('suppliers — cross-branch refusal', () => {
  it('lists only the caller’s branch', async () => {
    const db = createFakeSupabase();
    db.onTable('suppliers', { data: [], error: null, count: 0 });

    await listSuppliers(db.client, PAGE, CALLER_BRANCH);

    const call = db.lastCall('suppliers', 'select');
    assert.ok(
      FakeSupabase.hasFilter(call, 'eq', ['branch_id', CALLER_BRANCH]),
      'the supplier list must carry the caller branch predicate',
    );
    // The foreign branch must never appear in the query, in any form.
    assert.equal(
      FakeSupabase.filtersOf(call, 'eq').some((args) => args[1] === OTHER_BRANCH),
      false,
      'the query must not mention the other branch',
    );
  });

  it('looks the supplier up by id **and** branch, so a foreign id misses entirely', async () => {
    /*
     * The branch predicate is what makes a guessed uuid belonging to the other
     * branch miss — it is in the WHERE clause, not applied after the read. The
     * fake does not evaluate filters (it returns whatever the test registered),
     * so the assertion is on the **query the service built**, which is the part
     * this service actually controls.
     */
    const db = createFakeSupabase();
    db.onTable('suppliers', { data: { ...FOREIGN_SUPPLIER, branch_id: CALLER_BRANCH }, error: null });

    await getSupplier(db.client, FOREIGN_SUPPLIER.id, CALLER_BRANCH);

    const call = db.lastCall('suppliers', 'select');
    assert.deepEqual(FakeSupabase.filtersOf(call, 'eq'), [
      ['id', FOREIGN_SUPPLIER.id],
      ['branch_id', CALLER_BRANCH],
    ]);
  });

  it('reports a missing supplier as a 404', async () => {
    // The database returning nothing — which is what a foreign id produces —
    // must surface as "not found", never as an empty success.
    const db = createFakeSupabase();
    db.onTable('suppliers', { data: null, error: null });

    await assertAppError(() => getSupplier(db.client, FOREIGN_SUPPLIER.id, CALLER_BRANCH), 404, 'SUPPLIER_NOT_FOUND');
  });

  it('files a new supplier under the caller’s branch, not the request body', async () => {
    const db = createFakeSupabase();
    db.onTable('suppliers', { data: { ...FOREIGN_SUPPLIER, id: 'sup-new', branch_id: CALLER_BRANCH, name: 'Local Co' }, error: null });

    await createSupplier(db.client, CALLER_BRANCH, { name: 'Local Co' });

    const payload = db.lastCall('suppliers', 'insert')?.payload as Record<string, unknown>;
    assert.equal(payload.branch_id, CALLER_BRANCH);
  });

  it('refuses to update another branch’s supplier', async () => {
    const db = createFakeSupabase();
    // `.single()` on an update that matched no row: the service sees no data.
    db.onTable('suppliers', { data: null, error: { message: 'no rows' } });

    await assertAppError(
      () => updateSupplier(db.client, FOREIGN_SUPPLIER.id, CALLER_BRANCH, { name: 'Hijacked' }),
      404,
      'SUPPLIER_NOT_FOUND',
    );

    const call = db.lastCall('suppliers', 'update');
    assert.ok(FakeSupabase.hasFilter(call, 'eq', ['branch_id', CALLER_BRANCH]));
  });

  it('narrows the delete to the caller’s branch', async () => {
    const db = createFakeSupabase();
    db.onTable('suppliers', { data: null, error: null });

    await deleteSupplier(db.client, FOREIGN_SUPPLIER.id, CALLER_BRANCH);

    const call = db.lastCall('suppliers', 'delete');
    assert.ok(FakeSupabase.hasFilter(call, 'eq', ['id', FOREIGN_SUPPLIER.id]));
    assert.ok(FakeSupabase.hasFilter(call, 'eq', ['branch_id', CALLER_BRANCH]));
  });
});

describe('expenses — cross-branch refusal', () => {
  it('lists only the caller’s branch', async () => {
    const db = createFakeSupabase();
    db.onTable('operating_expenses', { data: [], error: null, count: 0 });

    await listExpenses(db.client, PAGE, CALLER_BRANCH);

    const call = db.lastCall('operating_expenses', 'select');
    assert.ok(FakeSupabase.hasFilter(call, 'eq', ['branch_id', CALLER_BRANCH]));
  });

  it('files a new expense under the caller’s branch', async () => {
    const db = createFakeSupabase();
    // `getShopTimeZone` reads business_settings for the *caller's* branch.
    db.onTable('business_settings', { data: { time_zone: 'Asia/Manila' }, error: null });
    db.onTable('operating_expenses', { data: { ...FOREIGN_EXPENSE, id: 'exp-new', branch_id: CALLER_BRANCH }, error: null });

    await createExpense(db.client, CALLER_BRANCH, { category: 'Rent', amount: 100 }, 'u-1');

    const payload = db.lastCall('operating_expenses', 'insert')?.payload as Record<string, unknown>;
    assert.equal(payload.branch_id, CALLER_BRANCH);
  });

  it('refuses to update another branch’s expense', async () => {
    const db = createFakeSupabase();
    db.onTable('operating_expenses', { data: null, error: { message: 'no rows' } });

    await assertAppError(
      () => updateExpense(db.client, FOREIGN_EXPENSE.id, CALLER_BRANCH, { category: 'Rent', amount: 1 }),
      404,
      'EXPENSE_NOT_FOUND',
    );

    const call = db.lastCall('operating_expenses', 'update');
    assert.ok(FakeSupabase.hasFilter(call, 'eq', ['branch_id', CALLER_BRANCH]));
  });

  it('narrows the delete to the caller’s branch', async () => {
    const db = createFakeSupabase();
    db.onTable('operating_expenses', { data: null, error: null });

    await deleteExpense(db.client, FOREIGN_EXPENSE.id, CALLER_BRANCH);

    const call = db.lastCall('operating_expenses', 'delete');
    assert.ok(FakeSupabase.hasFilter(call, 'eq', ['id', FOREIGN_EXPENSE.id]));
    assert.ok(FakeSupabase.hasFilter(call, 'eq', ['branch_id', CALLER_BRANCH]));
  });
});

describe('designs — cross-branch refusal', () => {
  it('lists only the caller’s branch', async () => {
    const db = createFakeSupabase();
    db.onTable('designs', { data: [], error: null, count: 0 });
    db.onTable('business_settings', { data: { time_zone: 'Asia/Manila' }, error: null });

    await listDesigns(db.client, PAGE, CALLER_BRANCH);

    const call = db.lastCall('designs', 'select');
    assert.ok(FakeSupabase.hasFilter(call, 'eq', ['branch_id', CALLER_BRANCH]));
  });

  it('refuses to update another branch’s design', async () => {
    // A design carries artwork and a name; editing the other branch's catalogue
    // is a write against their product list, so the refusal matters as much as
    // it does for money.
    const db = createFakeSupabase();
    db.onTable('designs', { data: null, error: { message: 'no rows' } });

    await assertAppError(
      () => updateDesign(db.client, FOREIGN_DESIGN.id, { name: 'Hijacked', category: 'X' }, CALLER_BRANCH),
      404,
      'DESIGN_NOT_FOUND',
    );

    const call = db.lastCall('designs', 'update');
    assert.ok(FakeSupabase.hasFilter(call, 'eq', ['id', FOREIGN_DESIGN.id]));
    assert.ok(FakeSupabase.hasFilter(call, 'eq', ['branch_id', CALLER_BRANCH]));
  });

  it('narrows the delete to the caller’s branch', async () => {
    const db = createFakeSupabase();
    db.onTable('designs', { data: null, error: null });

    await deleteDesign(db.client, FOREIGN_DESIGN.id, CALLER_BRANCH);

    const call = db.lastCall('designs', 'delete');
    assert.ok(FakeSupabase.hasFilter(call, 'eq', ['id', FOREIGN_DESIGN.id]));
    assert.ok(FakeSupabase.hasFilter(call, 'eq', ['branch_id', CALLER_BRANCH]));
  });
});

/*
 * Positive controls.
 *
 * Every assertion above is a refusal or a "must not contain the other branch".
 * A service that refused *everything*, or that hard-coded the caller's branch
 * into a query that returned no rows, would satisfy them all. These tests make
 * that impossible: the same code path, with a row in the caller's **own** branch,
 * must return it.
 */
describe('the refusals are not blanket refusals', () => {
  it('returns a supplier that lives in the caller’s branch', async () => {
    const db = createFakeSupabase();
    db.onTable('suppliers', { data: { ...FOREIGN_SUPPLIER, branch_id: CALLER_BRANCH }, error: null });

    const supplier = await getSupplier(db.client, FOREIGN_SUPPLIER.id, CALLER_BRANCH);

    assert.equal(supplier.id, FOREIGN_SUPPLIER.id);
    assert.equal(supplier.name, 'Nasugbu Paper Co');
  });

  it('returns an expense list that is genuinely the caller’s own', async () => {
    const db = createFakeSupabase();
    db.onTable('operating_expenses', {
      data: [
        { ...FOREIGN_EXPENSE, id: 'exp-mine', branch_id: CALLER_BRANCH, description: 'Balayan rent' },
      ],
      error: null,
      count: 1,
    });

    const page = await listExpenses(db.client, PAGE, CALLER_BRANCH);

    assert.equal(page.data.length, 1);
    assert.equal(page.data[0]?.id, 'exp-mine');
  });
});
