import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getAnalyticsSummary } from '../../src/modules/analytics/analytics.service.js';
import { createFakeSupabase } from './helpers/fakeSupabase.js';

/**
 * Which code path produces the analytics numbers.
 *
 * `getAnalyticsSummary` prefers the `get_analytics_summary` RPC and silently
 * falls back to aggregating in JavaScript when the RPC fails. That fallback is
 * deliberate — it keeps the dashboard alive if the function is missing — but it
 * is also dangerous, because a *persistently broken* function looks identical to
 * a working one from the outside: both return a plausible summary and HTTP 200.
 *
 * That is exactly what happened. The deployed function raised
 * `42803 aggregate function calls cannot be nested`, the service logged a warning
 * nobody read, and the dashboard kept drawing charts from the fallback. The
 * defect was invisible precisely because the fallback worked.
 *
 * These tests pin the *branch*, not just the output: the RPC must be used when it
 * responds, and a response must never be assembled from two different sources.
 */

/** A minimal but complete RPC payload, with values no fallback could invent. */
const RPC_PAYLOAD = {
  revenue: 111_111.11,
  transactionCount: 7,
  orderCount: 3,
  averageTransactionValue: 15_873.02,
  salesByDay: [{ date: '2026-09-01', revenue: 111_111.11, transactions: 7 }],
  ordersByStatus: [
    { status: 'Completed', count: 2 },
    { status: 'Pending', count: 1 },
  ],
  topItems: [{ name: 'Sentinel Item', quantity: 42, revenue: 111_111.11 }],
  inventoryAlerts: 9,
};

const RANGE = { from: '2026-09-01', to: '2026-09-30' };

describe('analytics summary prefers the database function', () => {
  it('uses the RPC result and never touches the fallback tables', async () => {
    const supabase = createFakeSupabase().onRpc('get_analytics_summary', { data: RPC_PAYLOAD });

    const summary = await getAnalyticsSummary(supabase as never, RANGE);

    // Values that exist only in the RPC payload: if any of these came back the
    // number must have come from the function rather than from re-aggregation.
    assert.equal(summary.revenue, 111_111.11);
    assert.equal(summary.transactionCount, 7);
    assert.equal(summary.orderCount, 3);
    assert.equal(summary.inventoryAlerts, 9);
    assert.equal(summary.topItems[0]?.name, 'Sentinel Item');

    // The decisive check. `sales_transactions` is only read by the fallback, so a
    // call against it would mean the RPC path was not taken. The fake throws on
    // an unconfigured table, so this proves the branch as well as counting it.
    assert.equal(supabase.callsFor('sales_transactions').length, 0);
    assert.equal(supabase.callsFor('inventory_items').length, 0);
    assert.equal(supabase.callsFor('get_analytics_summary', 'rpc').length, 1);
  });

  it('passes the normalised range to the function as ISO timestamps', async () => {
    const supabase = createFakeSupabase().onRpc('get_analytics_summary', { data: RPC_PAYLOAD });

    await getAnalyticsSummary(supabase as never, RANGE);

    const call = supabase.lastCall('get_analytics_summary', 'rpc');
    assert.ok(call, 'the analysis function should have been called');
    const args = call.payload as { p_from: string; p_to: string };

    // Endpoints are widened to cover the whole day: a range that stopped at
    // 00:00:00 would silently exclude every sale made on the final day.
    assert.equal(args.p_from, '2026-09-01T00:00:00.000Z');
    assert.equal(args.p_to, '2026-09-30T23:59:59.999Z');
  });

  it('falls back when the function is genuinely unavailable', async () => {
    const supabase = createFakeSupabase()
      .onRpc('get_analytics_summary', { data: null, error: { message: 'aggregate function calls cannot be nested' } })
      .onTable('sales_transactions', {
        data: [{ total: 500, created_at: '2026-09-02T10:00:00.000Z' }],
      })
      .onTable('orders', { data: [{ status: 'Completed' }] })
      .onTable('sales_transaction_items', { data: [] })
      .onTable('inventory_items', { data: [] });

    const summary = await getAnalyticsSummary(supabase as never, RANGE);

    // The fallback is load-bearing and must keep working — it is what kept the
    // dashboard alive while the function was broken.
    assert.equal(summary.revenue, 500);
    assert.equal(summary.transactionCount, 1);
    assert.equal(summary.orderCount, 1);
    assert.equal(supabase.callsFor('sales_transactions').length, 1);
  });
});
