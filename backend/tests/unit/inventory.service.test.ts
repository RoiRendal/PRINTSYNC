import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  adjustInventoryStock,
  createInventoryItem,
  deleteInventoryItem,
  exportInventory,
  listInventory,
  updateInventoryItem,
} from '../../src/modules/inventory/inventory.service.js';
import { createFakeSupabase, FakeSupabase } from './helpers/fakeSupabase.js';
import { assertAppError } from './helpers/assertAppError.js';

/*
 * Stock is entirely separate per branch (migration 20261002000300): every item
 * carries a `branch_id`, and every read and write is narrowed to the caller's.
 * The `lowStock` filter and the branch filter now travel together, so an
 * assertion about one of them must not accidentally read the other — which is
 * exactly what `filterOf` did once `branch_id` became the first `.eq` on every
 * query. `hasFilter` names the predicate instead of its position.
 */

const BRANCH = 'branch-balayan';

const ITEM_ROW = {
  id: 'inv-1',
  sku: 'INV-0001',
  name: 'Glossy Paper',
  category: 'Supplies',
  stock: 25,
  reorder_level: 10,
  price: 12.5,
  cost_price: 8,
  uom: 'pc',
  image_url: '/product-images/INV-001.png',
  branch_id: BRANCH,
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-10T00:00:00.000Z',
};

describe('inventory.service', () => {
  describe('listInventory', () => {
    it('maps snake_case columns into the domain item', async () => {
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: [ITEM_ROW], error: null, count: 1 });

      const [item] = (await listInventory(db.client, { page: 1, limit: 20 }, BRANCH)).data;

      assert.ok(item);
      assert.equal(item.id, 'inv-1');
      assert.equal(item.sku, 'INV-0001');
      assert.equal(item.name, 'Glossy Paper');
      assert.equal(item.stock, 25);
      assert.equal(item.reorderLevel, 10);
      assert.equal(item.price, 12.5);
      assert.equal(item.costPrice, 8);
      assert.equal(item.imageUrl, '/product-images/INV-001.png');
      assert.equal(item.createdAt, '2026-09-01T00:00:00.000Z');
      assert.equal(item.updatedAt, '2026-09-10T00:00:00.000Z');
    });

    it('normalises missing optional columns to safe defaults', async () => {
      const db = createFakeSupabase();
      db.queueTable('inventory_items', {
        data: [{ ...ITEM_ROW, cost_price: null, image_url: null }],
        error: null,
        count: 1,
      });

      const [item] = (await listInventory(db.client, { page: 1, limit: 20 }, BRANCH)).data;

      assert.ok(item);
      assert.equal(item.costPrice, 0);
      assert.equal(item.imageUrl, null);
    });

    it('translates page/limit into an inclusive range', async () => {
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: [], error: null, count: 0 });

      await listInventory(db.client, { page: 2, limit: 25 }, BRANCH);

      assert.deepEqual(FakeSupabase.filterOf(db.callsFor('inventory_items')[0], 'range'), [25, 49]);
    });

    it('returns the pagination envelope', async () => {
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: [ITEM_ROW], error: null, count: 42 });

      const response = await listInventory(db.client, { page: 1, limit: 20 }, BRANCH);

      assert.deepEqual(
        { total: response.total, page: response.page, limit: response.limit, rows: response.data.length },
        { total: 42, page: 1, limit: 20, rows: 1 },
      );
    });

    it('maps a lookup failure to a 503 INVENTORY_LOOKUP_FAILED', async () => {
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: null, error: { message: 'timeout' } });

      await assertAppError(() => listInventory(db.client, { page: 1, limit: 20 }, BRANCH), 503, 'INVENTORY_LOOKUP_FAILED');
    });

    it('always narrows the list to the caller\'s branch', async () => {
      // The shelf is the branch's own. Without this predicate the list would mix
      // both shops' stock and every count on the page would be wrong.
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: [ITEM_ROW], error: null, count: 1 });

      await listInventory(db.client, { page: 1, limit: 20 }, BRANCH);

      assert.ok(FakeSupabase.hasFilter(db.callsFor('inventory_items')[0], 'eq', ['branch_id', BRANCH]));
    });

    it('filters to low-stock items when asked', async () => {
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: [ITEM_ROW], error: null, count: 1 });

      await listInventory(db.client, { page: 1, limit: 20 }, BRANCH, true);

      assert.ok(FakeSupabase.hasFilter(db.callsFor('inventory_items')[0], 'eq', ['is_low_stock', true]));
    });

    it('sends no low-stock filter when not asked', async () => {
      // The inverse bug: a filter applied unconditionally would hide items from
      // every caller that never asked to filter, and the list would look broken
      // rather than over-eager.
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: [ITEM_ROW], error: null, count: 1 });

      await listInventory(db.client, { page: 1, limit: 20 }, BRANCH);

      assert.equal(FakeSupabase.hasFilter(db.callsFor('inventory_items')[0], 'eq', ['is_low_stock', true]), false);
    });

    it('reports the filtered total, not the table total', async () => {
      // The fake returns whatever `count` is queued, standing in for what PostgREST
      // computes once the filter is applied. The assertion that matters is that the
      // service passes that number straight through instead of substituting its own.
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: [ITEM_ROW], error: null, count: 5 });

      const response = await listInventory(db.client, { page: 1, limit: 20 }, BRANCH, true);

      assert.equal(response.total, 5);
      assert.equal(response.data.length, 1);
    });

    it('still applies the range to a filtered query', async () => {
      // Filtering must not displace paging: a filtered list that always returned
      // page 1 would be a different bug with the same symptom.
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: [ITEM_ROW], error: null, count: 1 });

      await listInventory(db.client, { page: 2, limit: 5 }, BRANCH, true);

      const call = db.callsFor('inventory_items')[0];
      assert.ok(FakeSupabase.hasFilter(call, 'eq', ['is_low_stock', true]));
      assert.deepEqual(FakeSupabase.filterOf(call, 'range'), [5, 9]);
    });
  });

  describe('createInventoryItem', () => {
    it('generates an uppercase INV- prefixed SKU when none is supplied', async () => {
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: ITEM_ROW, error: null });

      await createInventoryItem(db.client, BRANCH, { name: 'New Item', category: 'Supplies', reorderLevel: 5, price: 10 });

      const payload = db.lastCall('inventory_items', 'insert')?.payload as Record<string, unknown>;
      assert.match(String(payload.sku), /^INV-[0-9A-F]{8}$/);
    });

    it('keeps a caller supplied SKU', async () => {
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: ITEM_ROW, error: null });

      await createInventoryItem(db.client, BRANCH, {
        sku: 'CUSTOM-1',
        name: 'New Item',
        category: 'Supplies',
        reorderLevel: 5,
        price: 10,
      });

      const payload = db.lastCall('inventory_items', 'insert')?.payload as Record<string, unknown>;
      assert.equal(payload.sku, 'CUSTOM-1');
    });

    it('defaults stock, cost price and image to empty values', async () => {
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: ITEM_ROW, error: null });

      await createInventoryItem(db.client, BRANCH, { name: 'New Item', category: 'Supplies', reorderLevel: 5, price: 10 });

      const payload = db.lastCall('inventory_items', 'insert')?.payload as Record<string, unknown>;
      assert.equal(payload.stock, 0);
      assert.equal(payload.cost_price, 0);
      assert.equal(payload.image_url, null);
      assert.equal(payload.reorder_level, 5);
    });

    it('files the new item on the caller\'s branch', async () => {
      // An item cannot exist without a shop that holds it: the column is
      // `not null` with no default, and the branch is the service argument
      // rather than anything the client can send.
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: ITEM_ROW, error: null });

      await createInventoryItem(db.client, BRANCH, { name: 'New Item', category: 'Supplies', reorderLevel: 5, price: 10 });

      const payload = db.lastCall('inventory_items', 'insert')?.payload as Record<string, unknown>;
      assert.equal(payload.branch_id, BRANCH);
    });

    it('maps an insert failure to a 400 INVENTORY_CREATE_FAILED', async () => {
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: null, error: { message: 'duplicate sku' } });

      await assertAppError(
        () => createInventoryItem(db.client, BRANCH, { name: 'New Item', category: 'Supplies', reorderLevel: 5, price: 10 }),
        400,
        'INVENTORY_CREATE_FAILED',
      );
    });
  });

  describe('updateInventoryItem', () => {
    it('omits the SKU column when the caller does not change it', async () => {
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: ITEM_ROW, error: null });

      await updateInventoryItem(db.client, 'inv-1', BRANCH, {
        name: 'Glossy Paper (A4)',
        category: 'Supplies',
        reorderLevel: 10,
        price: 13,
      });

      const payload = db.lastCall('inventory_items', 'update')?.payload as Record<string, unknown>;
      assert.equal('sku' in payload, false);
      assert.equal(payload.name, 'Glossy Paper (A4)');
      assert.equal(payload.reorder_level, 10);
    });

    it('includes the SKU column when it is supplied', async () => {
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: ITEM_ROW, error: null });

      await updateInventoryItem(db.client, 'inv-1', BRANCH, {
        sku: 'INV-NEW',
        name: 'Glossy Paper',
        category: 'Supplies',
        reorderLevel: 10,
        price: 13,
      });

      const payload = db.lastCall('inventory_items', 'update')?.payload as Record<string, unknown>;
      assert.equal(payload.sku, 'INV-NEW');
    });

    /*
     * The photo used to be written as `input.imageUrl ?? null`, so an update
     * that simply did not mention it erased the item's picture — one PATCH
     * correcting a price and the photo was gone, with nothing in the response to
     * say so. Omission now means "leave it alone", the same rule `sku` and `uom`
     * already had; removal is an explicit `null`.
     */
    it('leaves the photo alone when the caller does not mention it', async () => {
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: ITEM_ROW, error: null });

      await updateInventoryItem(db.client, 'inv-1', BRANCH, {
        name: 'Glossy Paper (A4)',
        category: 'Supplies',
        reorderLevel: 10,
        price: 13,
      });

      const payload = db.lastCall('inventory_items', 'update')?.payload as Record<string, unknown>;
      assert.equal('image_url' in payload, false);
    });

    it('clears the photo when the caller sends an explicit null', async () => {
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: ITEM_ROW, error: null });

      await updateInventoryItem(db.client, 'inv-1', BRANCH, {
        name: 'Glossy Paper (A4)',
        category: 'Supplies',
        reorderLevel: 10,
        price: 13,
        imageUrl: null,
      });

      const payload = db.lastCall('inventory_items', 'update')?.payload as Record<string, unknown>;
      assert.equal(payload.image_url, null);
    });

    it('scopes the update to the requested id and branch', async () => {
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: ITEM_ROW, error: null });

      await updateInventoryItem(db.client, 'inv-1', BRANCH, { name: 'x', category: 'y', reorderLevel: 1, price: 1 });

      assert.deepEqual(FakeSupabase.filtersOf(db.lastCall('inventory_items', 'update'), 'eq'), [
        ['id', 'inv-1'],
        ['branch_id', BRANCH],
      ]);
    });

    it('maps a missing row to a 404 INVENTORY_NOT_FOUND', async () => {
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: null, error: null });

      await assertAppError(
        () => updateInventoryItem(db.client, 'missing', BRANCH, { name: 'x', category: 'y', reorderLevel: 1, price: 1 }),
        404,
        'INVENTORY_NOT_FOUND',
      );
    });
  });

  describe('deleteInventoryItem', () => {
    it('deletes the requested row from the caller\'s branch', async () => {
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: null, error: null });

      await deleteInventoryItem(db.client, 'inv-1', BRANCH);

      const call = db.lastCall('inventory_items', 'delete');
      assert.deepEqual(FakeSupabase.filtersOf(call, 'eq'), [
        ['id', 'inv-1'],
        ['branch_id', BRANCH],
      ]);
    });

    it('maps a delete failure to a 404 INVENTORY_DELETE_FAILED', async () => {
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: null, error: { message: 'referenced by an order' } });

      await assertAppError(() => deleteInventoryItem(db.client, 'inv-1', BRANCH), 404, 'INVENTORY_DELETE_FAILED');
    });
  });

  describe('adjustInventoryStock', () => {
    it('checks the item belongs to the caller\'s branch before moving any stock', async () => {
      // `adjust_inventory_stock` takes only an item id and has no branch
      // predicate inside it, so the check has to happen here. Without it a
      // Nasugbu staff member who knew a Balayan item id could move Balayan's
      // stock — so the read is asserted, not just the RPC call.
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: { id: 'inv-1' }, error: null });
      db.queueRpc('adjust_inventory_stock', { data: { ...ITEM_ROW, stock: 22 } });

      await adjustInventoryStock(db.client, 'inv-1', BRANCH, -3, 'Damaged in transit', 'actor-1');

      assert.deepEqual(FakeSupabase.filtersOf(db.lastCall('inventory_items', 'select'), 'eq'), [
        ['id', 'inv-1'],
        ['branch_id', BRANCH],
      ]);
    });

    it('refuses to move stock for an item outside the caller\'s branch', async () => {
      // The ownership read finds nothing, so the RPC is never reached: a 404
      // rather than a successful adjustment of the other shop's shelf.
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: null, error: null });
      db.queueRpc('adjust_inventory_stock', { data: { ...ITEM_ROW, stock: 22 } });

      await assertAppError(
        () => adjustInventoryStock(db.client, 'inv-1', BRANCH, -3, 'Damaged in transit', 'actor-1'),
        404,
        'INVENTORY_NOT_FOUND',
      );
      assert.equal(db.callsFor('adjust_inventory_stock').length, 0);
    });

    it('forwards the movement to the RPC and returns the recalculated item', async () => {
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: { id: 'inv-1' }, error: null });
      db.queueRpc('adjust_inventory_stock', { data: { ...ITEM_ROW, stock: 22 } });

      const item = await adjustInventoryStock(db.client, 'inv-1', BRANCH, -3, 'Damaged in transit', 'actor-1');

      const payload = db.lastCall('adjust_inventory_stock')?.payload as Record<string, unknown>;
      assert.equal(payload.p_item_id, 'inv-1');
      assert.equal(payload.p_quantity, -3);
      assert.equal(payload.p_reason, 'Damaged in transit');
      assert.equal(payload.p_actor_id, 'actor-1');
      assert.equal(item.stock, 22);
    });

    it('accepts a positive restock movement', async () => {
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: { id: 'inv-1' }, error: null });
      db.queueRpc('adjust_inventory_stock', { data: { ...ITEM_ROW, stock: 40 } });

      const item = await adjustInventoryStock(db.client, 'inv-1', BRANCH, 15, 'Delivery received', 'actor-1');

      assert.equal(item.stock, 40);
    });

    it('maps an adjustment failure to a 400 INVENTORY_ADJUSTMENT_FAILED', async () => {
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: { id: 'inv-1' }, error: null });
      db.queueRpc('adjust_inventory_stock', { data: null, error: { message: 'stock cannot go negative' } });

      await assertAppError(
        () => adjustInventoryStock(db.client, 'inv-1', BRANCH, -100, 'Correction', 'actor-1'),
        400,
        'INVENTORY_ADJUSTMENT_FAILED',
      );
    });

    it('reports a failed ownership read as an outage, not a missing item', async () => {
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: null, error: { message: 'timeout' } });

      await assertAppError(
        () => adjustInventoryStock(db.client, 'inv-1', BRANCH, -3, 'Damaged', 'actor-1'),
        503,
        'INVENTORY_LOOKUP_FAILED',
      );
    });
  });

  describe('exportInventory', () => {
    it('reads the whole branch without a range', async () => {
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: [ITEM_ROW], error: null });

      const items = await exportInventory(db.client, BRANCH);

      assert.equal(items.length, 1);
      assert.equal(FakeSupabase.filterOf(db.callsFor('inventory_items')[0], 'range'), undefined);
      assert.ok(FakeSupabase.hasFilter(db.callsFor('inventory_items')[0], 'eq', ['branch_id', BRANCH]));
    });

    it('maps a lookup failure to a 503', async () => {
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: null, error: { message: 'down' } });

      await assertAppError(() => exportInventory(db.client, BRANCH), 503, 'INVENTORY_LOOKUP_FAILED');
    });
  });
});
