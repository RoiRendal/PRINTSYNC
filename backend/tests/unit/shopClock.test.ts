import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import {
  DEFAULT_SHOP_TIME_ZONE,
  getShopTimeZone,
  isValidTimeZone,
  resetShopTimeZoneCache,
  shopDateParts,
  shopDayEnd,
  shopDayStart,
  shopToday,
  toShopDateKey,
} from '../../src/shared/shopClock.js';
import { createFakeSupabase } from './helpers/fakeSupabase.js';

/**
 * The bug these pin down.
 *
 * Every timestamp is `timestamptz` and Supabase returns it as a UTC ISO string.
 * The code derived calendar dates by slicing the first ten characters — or asking
 * `toISOString()` for them — which answers "what date is it in UTC?". For a UTC+8
 * shop that is wrong for the whole morning shift: a sale rung up at 07:30 local is
 * `23:30Z` the previous day.
 *
 * The fixed instant below is the case that matters. `2026-09-21T17:30:00Z` is
 * 01:30 on the 22nd in Manila, so the old code reported the 21st and the new code
 * must report the 22nd.
 */

const MORNING_SALE_MANILA = '2026-09-21T17:30:00.000Z'; // 2026-09-22 01:30 +08:00

describe('shop-local calendar dates', () => {
  it('puts an instant on the next day when the shop is ahead of UTC', () => {
    // The headline case. Before this fix the answer was '2026-09-21'.
    assert.equal(toShopDateKey(MORNING_SALE_MANILA, 'Asia/Manila'), '2026-09-22');
  });

  it('is genuinely reading the zone, not ignoring it', () => {
    // Same instant, three zones, three answers — so a passing test above cannot be
    // the result of the zone argument being dropped on the floor.
    assert.equal(toShopDateKey(MORNING_SALE_MANILA, 'UTC'), '2026-09-21');
    assert.equal(toShopDateKey(MORNING_SALE_MANILA, 'Asia/Manila'), '2026-09-22');
    assert.equal(toShopDateKey(MORNING_SALE_MANILA, 'America/New_York'), '2026-09-21');
  });

  it('handles a zone behind UTC landing on the previous day', () => {
    // 2026-09-21T02:00Z is 2026-09-20 19:00 in Los Angeles (UTC-7).
    assert.equal(toShopDateKey('2026-09-21T02:00:00.000Z', 'America/Los_Angeles'), '2026-09-20');
  });

  it('accepts a Date as readily as a string', () => {
    assert.equal(toShopDateKey(new Date(MORNING_SALE_MANILA), 'Asia/Manila'), '2026-09-22');
  });

  it('returns an empty string rather than throwing on an unusable value', () => {
    // Parity with the `String(value).slice(0, 10)` this replaced: one malformed row
    // should not turn a list endpoint into a 500.
    assert.equal(toShopDateKey('not a date', 'Asia/Manila'), '');
  });

  it('reports the shop calendar parts, with a 1-based month', () => {
    assert.deepEqual(shopDateParts(MORNING_SALE_MANILA, 'Asia/Manila'), { year: 2026, month: 9, day: 22 });
  });

  it('derives today from the zone, not from the UTC date', () => {
    // 17:30Z is already the 22nd in Manila.
    assert.equal(shopToday('Asia/Manila', new Date(MORNING_SALE_MANILA)), '2026-09-22');
    assert.equal(shopToday('UTC', new Date(MORNING_SALE_MANILA)), '2026-09-21');
  });
});

describe('shop day boundaries', () => {
  it('starts a Manila day eight hours before UTC midnight', () => {
    const start = shopDayStart('2026-09-21', 'Asia/Manila');
    assert.equal(start.toISOString(), '2026-09-20T16:00:00.000Z');
  });

  it('ends a Manila day eight hours before the next UTC midnight', () => {
    const end = shopDayEnd('2026-09-21', 'Asia/Manila');
    assert.equal(end.toISOString(), '2026-09-21T15:59:59.999Z');
  });

  it('covers exactly one day, start to end', () => {
    const span = shopDayEnd('2026-09-21', 'Asia/Manila').getTime() - shopDayStart('2026-09-21', 'Asia/Manila').getTime();
    assert.equal(span, 86_400_000 - 1);
  });

  it('places a morning sale inside the day it was sold on', () => {
    // The regression, stated as the range check that failed: the old UTC window for
    // the 21st began at 2026-09-21T00:00Z, which is eight hours *after* this sale.
    const start = shopDayStart('2026-09-21', 'Asia/Manila');
    const end = shopDayEnd('2026-09-21', 'Asia/Manila');
    const sale = new Date('2026-09-20T23:30:00.000Z'); // 2026-09-21 07:30 +08:00

    assert.ok(sale >= start && sale <= end, 'a 07:30 Manila sale belongs to that Manila day');
    assert.equal(toShopDateKey(sale, 'Asia/Manila'), '2026-09-21');
  });

  it('follows the offset across a daylight-saving change', () => {
    // Proves the two-pass offset lookup, which matters for any zone that is not
    // Asia/Manila. New York is UTC-4 in July and UTC-5 in January.
    assert.equal(shopDayStart('2026-07-01', 'America/New_York').toISOString(), '2026-07-01T04:00:00.000Z');
    assert.equal(shopDayStart('2026-01-15', 'America/New_York').toISOString(), '2026-01-15T05:00:00.000Z');
  });
});

describe('validating a time zone', () => {
  it('accepts a real IANA zone and rejects a made-up one', () => {
    assert.equal(isValidTimeZone('Asia/Manila'), true);
    assert.equal(isValidTimeZone('Pacific/Kiritimati'), true);
    assert.equal(isValidTimeZone('Mars/Olympus_Mons'), false);
    assert.equal(isValidTimeZone(''), false);
  });
});

describe('resolving the shop time zone from settings', () => {
  beforeEach(() => {
    // Module-level cache, so a case would otherwise inherit the previous one's zone.
    resetShopTimeZoneCache();
  });

  it('uses the configured zone', async () => {
    const supabase = createFakeSupabase().onTable('business_settings', { data: { time_zone: 'Pacific/Kiritimati' } });

    assert.equal(await getShopTimeZone(supabase as never), 'Pacific/Kiritimati');
  });

  it('falls back to the default when the lookup fails', async () => {
    // No response configured for `business_settings`, so the fake throws — which is
    // how a real outage would present. A missing setting must not break a page.
    const supabase = createFakeSupabase();

    assert.equal(await getShopTimeZone(supabase as never), DEFAULT_SHOP_TIME_ZONE);
  });

  it('falls back when the stored zone is not a real one', async () => {
    const supabase = createFakeSupabase().onTable('business_settings', { data: { time_zone: 'Mars/Olympus_Mons' } });

    assert.equal(await getShopTimeZone(supabase as never), DEFAULT_SHOP_TIME_ZONE);
  });

  it('reads the setting once, not once per call', async () => {
    const supabase = createFakeSupabase().onTable('business_settings', { data: { time_zone: 'Asia/Manila' } });

    await getShopTimeZone(supabase as never);
    await getShopTimeZone(supabase as never);
    await getShopTimeZone(supabase as never);

    // The cache is the reason this is affordable in a row-mapping loop.
    assert.equal(supabase.callsFor('business_settings').length, 1);
  });
});
