import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getAnalyticsSummary,
  getInventoryForecast,
  getProductTrends,
  getSalesTimeline,
} from '../../src/modules/analytics/analytics.service.js';
import { FakeSupabase, createFakeSupabase } from './helpers/fakeSupabase.js';

const BALAYAN = '11111111-1111-1111-1111-111111111111';
const NASUGBU = '22222222-2222-2222-2222-222222222222';
const RANGE = { from: '2026-09-01', to: '2026-09-30' };

/*
 * Phase 4 moved the analytics reads from business-wide to branch-scoped, and the
 * RPC from two parameters to three.
 *
 * These tests assert the **query shape** rather than a returned value, because the
 * fake Supabase does not evaluate filters — it hands back whatever the test
 * registered. That makes a value assertion worthless for a scoping test: a service
 * that dropped `.eq('branch_id', …)` would still return the configured row and the
 * test would pass. Asserting the predicate instead is what actually proves the
 * branch reached the query.
 *
 * The single most important case is the first one below: that `p_branch_id` is
 * **sent at all**. Before Phase 4 the RPC was called with two arguments and
 * aggregated every branch, and nothing anywhere failed — it just returned a bigger
 * number.
 */

/** The args of the one `get_analytics_summary` call. */
function summaryRpcArgs(fake: FakeSupabase): Record<string, unknown> {
  const call = fake.lastCall('get_analytics_summary', 'rpc');
  assert.ok(call, 'expected get_analytics_summary to be called');
  return call.payload as Record<string, unknown>;
}

describe('getAnalyticsSummary — the RPC is branch-scoped', () => {
  it('passes p_branch_id to get_analytics_summary', async () => {
    const fake = createFakeSupabase()
      .onTable('business_settings', { data: { time_zone: 'Asia/Manila' } })
      .onRpc('get_analytics_summary', {
        data: { revenue: 0, transactionCount: 0, orderCount: 0, salesByDay: [], ordersByStatus: [], topItems: [], inventoryAlerts: 0 },
      });

    await getAnalyticsSummary(fake.client, RANGE, BALAYAN);

    assert.equal(summaryRpcArgs(fake).p_branch_id, BALAYAN);
  });

  it('passes p_branch_id: null for the combined view, not an absent argument', async () => {
    // `null` is the explicit "all branches" instruction the migration defines. An
    // omitted argument would rely on the SQL default, which happens to be null too —
    // but the two are not the same promise, and only one of them survives a future
    // change of default.
    const fake = createFakeSupabase()
      .onTable('business_settings', { data: { time_zone: 'Asia/Manila' } })
      .onRpc('get_analytics_summary', {
        data: { revenue: 0, transactionCount: 0, orderCount: 0, salesByDay: [], ordersByStatus: [], topItems: [], inventoryAlerts: 0 },
      });

    await getAnalyticsSummary(fake.client, RANGE, null);

    const args = summaryRpcArgs(fake);
    assert.ok('p_branch_id' in args, 'p_branch_id must be sent explicitly');
    assert.equal(args.p_branch_id, null);
  });

  it('still sends p_from and p_to alongside the branch', async () => {
    const fake = createFakeSupabase()
      .onTable('business_settings', { data: { time_zone: 'Asia/Manila' } })
      .onRpc('get_analytics_summary', {
        data: { revenue: 0, transactionCount: 0, orderCount: 0, salesByDay: [], ordersByStatus: [], topItems: [], inventoryAlerts: 0 },
      });

    await getAnalyticsSummary(fake.client, RANGE, BALAYAN);

    const args = summaryRpcArgs(fake);
    assert.ok(typeof args.p_from === 'string' && args.p_from.length > 0);
    assert.ok(typeof args.p_to === 'string' && args.p_to.length > 0);
  });

  it('reads the time zone for the branch it is reporting on', async () => {
    const fake = createFakeSupabase()
      .onTable('business_settings', { data: { time_zone: 'Asia/Manila' } })
      .onRpc('get_analytics_summary', {
        data: { revenue: 0, transactionCount: 0, orderCount: 0, salesByDay: [], ordersByStatus: [], topItems: [], inventoryAlerts: 0 },
      });

    await getAnalyticsSummary(fake.client, RANGE, NASUGBU);

    const settingsCall = fake.lastCall('business_settings', 'select');
    assert.ok(
      FakeSupabase.hasFilter(settingsCall, 'eq', ['branch_id', NASUGBU]),
      'the time zone must be read for the branch being reported on',
    );
  });
});

describe('getSalesTimeline — every read is branch-scoped', () => {
  it('narrows sales_transactions, the joined items and inventory to the branch', async () => {
    const fake = createFakeSupabase()
      .onTable('business_settings', { data: { time_zone: 'Asia/Manila' } })
      .onTable('sales_transactions', { data: [] })
      .onTable('sales_transaction_items', { data: [] })
      .onTable('inventory_items', { data: [] });

    await getSalesTimeline(fake.client, RANGE, 'day', BALAYAN);

    assert.ok(
      FakeSupabase.hasFilter(fake.lastCall('sales_transactions'), 'eq', ['branch_id', BALAYAN]),
      'sales_transactions must be scoped by its own branch_id',
    );
    assert.ok(
      FakeSupabase.hasFilter(fake.lastCall('sales_transaction_items'), 'eq', ['transaction.branch_id', BALAYAN]),
      'sales_transaction_items must be scoped through its parent — it has no branch_id column',
    );
    assert.ok(
      FakeSupabase.hasFilter(fake.lastCall('inventory_items'), 'eq', ['branch_id', BALAYAN]),
      'the cost map must be branch-scoped, or COGS is computed against the other shop',
    );
  });

  it('adds no branch predicate for the combined view', async () => {
    const fake = createFakeSupabase()
      .onTable('business_settings', { data: { time_zone: 'Asia/Manila' } })
      .onTable('sales_transactions', { data: [] })
      .onTable('sales_transaction_items', { data: [] })
      .onTable('inventory_items', { data: [] });

    await getSalesTimeline(fake.client, RANGE, 'day', null);

    assert.equal(
      FakeSupabase.filtersOf(fake.lastCall('sales_transactions'), 'eq').some((args) => args[0] === 'branch_id'),
      false,
      'the combined view must not carry a branch predicate',
    );
  });
});

describe('getProductTrends — scoped through the parent transaction', () => {
  it('narrows sales_transaction_items to the branch via transaction.branch_id', async () => {
    const fake = createFakeSupabase()
      .onTable('business_settings', { data: { time_zone: 'Asia/Manila' } })
      .onTable('sales_transaction_items', { data: [] });

    await getProductTrends(fake.client, RANGE, 'day', BALAYAN);

    assert.ok(
      FakeSupabase.hasFilter(fake.lastCall('sales_transaction_items'), 'eq', ['transaction.branch_id', BALAYAN]),
    );
  });
});

describe('getInventoryForecast — demand and stock from the same branch', () => {
  it('scopes both the demand query and the stock query to the branch', async () => {
    const fake = createFakeSupabase()
      .onTable('business_settings', { data: { time_zone: 'Asia/Manila' } })
      .onTable('sales_transaction_items', { data: [] })
      .onTable('inventory_items', { data: [] });

    await getInventoryForecast(fake.client, RANGE, 30, BALAYAN);

    assert.ok(
      FakeSupabase.hasFilter(fake.lastCall('sales_transaction_items'), 'eq', ['transaction.branch_id', BALAYAN]),
      'demand must come from this branch’s sales',
    );
    assert.ok(
      FakeSupabase.hasFilter(fake.lastCall('inventory_items'), 'eq', ['branch_id', BALAYAN]),
      'stock on hand must be this branch’s stock — otherwise the forecast mixes two shops',
    );
  });
});
