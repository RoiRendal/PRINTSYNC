import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { getAnalyticsSummary } from '../../src/modules/analytics/analytics.service.js';
import { resetShopTimeZoneCache } from '../../src/shared/shopClock.js';
import { createFakeSupabase } from './helpers/fakeSupabase.js';

/**
 * Which code path produces the analytics numbers.
 *
 * `getAnalyticsSummary` reads the `get_analytics_summary` RPC and nothing else.
 * There used to be a client-side fallback here that re-aggregated the same figures
 * from four table reads whenever the RPC failed; it was removed on 2026-09-21, and
 * the service carries the reasoning.
 *
 * Why it was dangerous is why these tests exist. The deployed function raised
 * `42803 aggregate function calls cannot be nested`, the service logged a warning
 * nobody read, and the dashboard kept drawing charts from the fallback — so a
 * *persistently broken* function looked identical to a working one from the
 * outside: a plausible summary and HTTP 200 either way.
 *
 * These tests pin the *branch*, not just the output. The RPC must be used when it
 * responds, a failure must surface as a 503 rather than a number, and the old
 * fallback's tables must never be read — that last one is what proves the second
 * implementation is gone rather than merely unreachable.
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
  beforeEach(() => {
    // `getShopTimeZone` caches the resolved zone in the module, so without this a
    // case would inherit whatever the previous one configured.
    resetShopTimeZoneCache();
  });

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

  it('sends the range as whole days in the shop time zone', async () => {
    const supabase = createFakeSupabase().onRpc('get_analytics_summary', { data: RPC_PAYLOAD });

    await getAnalyticsSummary(supabase as never, RANGE);

    const call = supabase.lastCall('get_analytics_summary', 'rpc');
    assert.ok(call, 'the analysis function should have been called');
    const args = call.payload as { p_from: string; p_to: string };

    // Endpoints are still widened to cover the whole day — a range that stopped at
    // 00:00:00 would silently exclude every sale made on the final day.
    //
    // What changed is *whose* day. These are 00:00 on the 1st and the last
    // millisecond of the 30th in Asia/Manila (UTC+8), not in UTC. The previous
    // expectations were the UTC boundaries, which started eight hours into the 1st
    // and ended eight hours before the end of the 30th: the whole morning of the
    // first day fell outside the window, and the last evening of the last day was
    // reported a day early.
    assert.equal(args.p_from, '2026-08-31T16:00:00.000Z');
    assert.equal(args.p_to, '2026-09-30T15:59:59.999Z');
  });

  it('moves the range when the shop time zone changes', async () => {
    // The decisive test for the *setting* rather than the constant: a fixed
    // `Asia/Manila` in the code would pass the assertion above and fail this one.
    const supabase = createFakeSupabase()
      .onRpc('get_analytics_summary', { data: RPC_PAYLOAD })
      .onTable('business_settings', { data: { time_zone: 'UTC' } });

    await getAnalyticsSummary(supabase as never, RANGE);

    const args = supabase.lastCall('get_analytics_summary', 'rpc')?.payload as { p_from: string; p_to: string };
    assert.equal(args.p_from, '2026-09-01T00:00:00.000Z');
    assert.equal(args.p_to, '2026-09-30T23:59:59.999Z');
  });

  it('fails loudly when the function is unavailable, instead of re-aggregating', async () => {
    // Every table the old fallback read is configured here, and would have
    // produced a plausible summary. That is deliberate: it means the assertions
    // below cannot pass merely because a fixture was missing.
    const supabase = createFakeSupabase()
      .onRpc('get_analytics_summary', { data: null, error: { message: 'aggregate function calls cannot be nested' } })
      .onTable('sales_transactions', { data: [{ total: 500, created_at: '2026-09-02T10:00:00.000Z' }] })
      .onTable('orders', { data: [{ status: 'Completed' }] })
      .onTable('sales_transaction_items', { data: [] })
      .onTable('inventory_items', { data: [] });

    await assert.rejects(
      () => getAnalyticsSummary(supabase as never, RANGE),
      (error: unknown) => {
        const appError = error as { statusCode?: number; code?: string };
        assert.equal(appError.statusCode, 503);
        assert.equal(appError.code, 'ANALYTICS_LOOKUP_FAILED');
        return true;
      },
    );

    // The decisive assertion. Those four tables were read *only* by the fallback,
    // so zero calls is what proves the second implementation is gone rather than
    // merely unreachable from here.
    assert.equal(supabase.callsFor('sales_transactions').length, 0);
    assert.equal(supabase.callsFor('orders').length, 0);
    assert.equal(supabase.callsFor('sales_transaction_items').length, 0);
    assert.equal(supabase.callsFor('inventory_items').length, 0);
  });

  it('fails the same way when the function returns nothing at all', async () => {
    // `data: null` with no error is the shape a missing function can take. It must
    // not be read as "no sales in this range" — that is a real number to a person
    // reading a chart, and it would be a lie.
    const supabase = createFakeSupabase().onRpc('get_analytics_summary', { data: null });

    await assert.rejects(
      () => getAnalyticsSummary(supabase as never, RANGE),
      (error: unknown) => {
        assert.equal((error as { code?: string }).code, 'ANALYTICS_LOOKUP_FAILED');
        return true;
      },
    );
  });
});
