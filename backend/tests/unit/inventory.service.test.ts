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

const ITEM_ROW = {
  id: 'inv-1',
  sku: 'INV-0001',
  name: 'Glossy Paper',
  category: 'Supplies',
  stock: 25,
  reorder_level: 10,
  price: 12.5,
  cost_price: 8,
  image_url: '/product-images/INV-001.png',
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-10T00:00:00.000Z',
};

describe('inventory.service', () => {
  describe('listInventory', () => {
    it('maps snake_case columns into the domain item', async () => {
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: [ITEM_ROW], error: null, count: 1 });

      const [item] = (await listInventory(db.client, { page: 1, limit: 20 })).data;

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

      const [item] = (await listInventory(db.client, { page: 1, limit: 20 })).data;

      assert.ok(item);
      assert.equal(item.costPrice, 0);
      assert.equal(item.imageUrl, null);
    });

    it('translates page/limit into an inclusive range', async () => {
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: [], error: null, count: 0 });

      await listInventory(db.client, { page: 2, limit: 25 });

      assert.deepEqual(FakeSupabase.filterOf(db.callsFor('inventory_items')[0], 'range'), [25, 49]);
    });

    it('returns the pagination envelope', async () => {
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: [ITEM_ROW], error: null, count: 42 });

      const response = await listInventory(db.client, { page: 1, limit: 20 });

      assert.deepEqual(
        { total: response.total, page: response.page, limit: response.limit, rows: response.data.length },
        { total: 42, page: 1, limit: 20, rows: 1 },
      );
    });

    it('maps a lookup failure to a 503 INVENTORY_LOOKUP_FAILED', async () => {
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: null, error: { message: 'timeout' } });

      await assertAppError(() => listInventory(db.client, { page: 1, limit: 20 }), 503, 'INVENTORY_LOOKUP_FAILED');
    });
  });

  describe('createInventoryItem', () => {
    it('generates an uppercase INV- prefixed SKU when none is supplied', async () => {
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: ITEM_ROW, error: null });

      await createInventoryItem(db.client, { name: 'New Item', category: 'Supplies', reorderLevel: 5, price: 10 });

      const payload = db.lastCall('inventory_items', 'insert')?.payload as Record<string, unknown>;
      assert.match(String(payload.sku), /^INV-[0-9A-F]{8}$/);
    });

    it('keeps a caller supplied SKU', async () => {
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: ITEM_ROW, error: null });

      await createInventoryItem(db.client, {
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

      await createInventoryItem(db.client, { name: 'New Item', category: 'Supplies', reorderLevel: 5, price: 10 });

      const payload = db.lastCall('inventory_items', 'insert')?.payload as Record<string, unknown>;
      assert.equal(payload.stock, 0);
      assert.equal(payload.cost_price, 0);
      assert.equal(payload.image_url, null);
      assert.equal(payload.reorder_level, 5);
    });

    it('maps an insert failure to a 400 INVENTORY_CREATE_FAILED', async () => {
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: null, error: { message: 'duplicate sku' } });

      await assertAppError(
        () => createInventoryItem(db.client, { name: 'New Item', category: 'Supplies', reorderLevel: 5, price: 10 }),
        400,
        'INVENTORY_CREATE_FAILED',
      );
    });
  });

  describe('updateInventoryItem', () => {
    it('omits the SKU column when the caller does not change it', async () => {
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: ITEM_ROW, error: null });

      await updateInventoryItem(db.client, 'inv-1', {
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

      await updateInventoryItem(db.client, 'inv-1', {
        sku: 'INV-NEW',
        name: 'Glossy Paper',
        category: 'Supplies',
        reorderLevel: 10,
        price: 13,
      });

      const payload = db.lastCall('inventory_items', 'update')?.payload as Record<string, unknown>;
      assert.equal(payload.sku, 'INV-NEW');
    });

    it('scopes the update to the requested id', async () => {
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: ITEM_ROW, error: null });

      await updateInventoryItem(db.client, 'inv-1', { name: 'x', category: 'y', reorderLevel: 1, price: 1 });

      assert.deepEqual(FakeSupabase.filterOf(db.lastCall('inventory_items', 'update'), 'eq'), ['id', 'inv-1']);
    });

    it('maps a missing row to a 404 INVENTORY_NOT_FOUND', async () => {
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: null, error: null });

      await assertAppError(
        () => updateInventoryItem(db.client, 'missing', { name: 'x', category: 'y', reorderLevel: 1, price: 1 }),
        404,
        'INVENTORY_NOT_FOUND',
      );
    });
  });

  describe('deleteInventoryItem', () => {
    it('deletes the requested row', async () => {
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: null, error: null });

      await deleteInventoryItem(db.client, 'inv-1');

      const call = db.lastCall('inventory_items', 'delete');
      assert.deepEqual(FakeSupabase.filterOf(call, 'eq'), ['id', 'inv-1']);
    });

    it('maps a delete failure to a 404 INVENTORY_DELETE_FAILED', async () => {
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: null, error: { message: 'referenced by an order' } });

      await assertAppError(() => deleteInventoryItem(db.client, 'inv-1'), 404, 'INVENTORY_DELETE_FAILED');
    });
  });

  describe('adjustInventoryStock', () => {
    it('forwards the movement to the RPC and returns the recalculated item', async () => {
      const db = createFakeSupabase();
      db.queueRpc('adjust_inventory_stock', { data: { ...ITEM_ROW, stock: 22 } });

      const item = await adjustInventoryStock(db.client, 'inv-1', -3, 'Damaged in transit', 'actor-1');

      const payload = db.lastCall('adjust_inventory_stock')?.payload as Record<string, unknown>;
      assert.equal(payload.p_item_id, 'inv-1');
      assert.equal(payload.p_quantity, -3);
      assert.equal(payload.p_reason, 'Damaged in transit');
      assert.equal(payload.p_actor_id, 'actor-1');
      assert.equal(item.stock, 22);
    });

    it('accepts a positive restock movement', async () => {
      const db = createFakeSupabase();
      db.queueRpc('adjust_inventory_stock', { data: { ...ITEM_ROW, stock: 40 } });

      const item = await adjustInventoryStock(db.client, 'inv-1', 15, 'Delivery received', 'actor-1');

      assert.equal(item.stock, 40);
    });

    it('maps an adjustment failure to a 400 INVENTORY_ADJUSTMENT_FAILED', async () => {
      const db = createFakeSupabase();
      db.queueRpc('adjust_inventory_stock', { data: null, error: { message: 'stock cannot go negative' } });

      await assertAppError(
        () => adjustInventoryStock(db.client, 'inv-1', -100, 'Correction', 'actor-1'),
        400,
        'INVENTORY_ADJUSTMENT_FAILED',
      );
    });
  });

  describe('exportInventory', () => {
    it('reads the whole table without a range', async () => {
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: [ITEM_ROW], error: null });

      const items = await exportInventory(db.client);

      assert.equal(items.length, 1);
      assert.equal(FakeSupabase.filterOf(db.callsFor('inventory_items')[0], 'range'), undefined);
    });

    it('maps a lookup failure to a 503', async () => {
      const db = createFakeSupabase();
      db.queueTable('inventory_items', { data: null, error: { message: 'down' } });

      await assertAppError(() => exportInventory(db.client), 503, 'INVENTORY_LOOKUP_FAILED');
    });
  });
});
