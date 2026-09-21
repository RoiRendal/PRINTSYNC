import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from './logger.js';

/**
 * Calendar dates in the shop's own time zone.
 *
 * ### The bug this exists to prevent
 *
 * Every timestamp in the database is `timestamptz`, and Supabase hands it back as
 * a UTC ISO string. Slicing the first ten characters off that string — or asking
 * `toISOString()` for them — answers "what date is it in UTC?", which is the wrong
 * question in two places at once:
 *
 *   1. **Display.** A shop in the Philippines is UTC+8, so a sale rung up at
 *      07:30 on Tuesday is `2026-09-21T23:30:00Z` and reads back as Monday.
 *   2. **Aggregation.** The daily series grouped on `to_char(created_at, ...)`
 *      splits the same business day across two buckets, and the analytics range
 *      `2026-09-01..2026-09-30` silently excludes everything sold before 08:00 on
 *      the first and includes an extra eight hours of the last.
 *
 * Every sale before 08:00 local therefore landed on the previous day — the whole
 * morning shift, every day.
 *
 * ### What replaces it
 *
 * `business_settings.time_zone` holds an IANA zone name (seeded `Asia/Manila`).
 * Dates are derived through it with `Intl.DateTimeFormat`, never by slicing a UTC
 * string. `toShopDateKey` is the one function that turns an instant into a
 * calendar day; the SQL side does the same with `at time zone`.
 *
 * The zone is read once and cached, because the API is single-instance by design
 * (see the in-process event bus and the 30-second auth cache) and this would
 * otherwise add a settings query to every page load.
 */

export const DEFAULT_SHOP_TIME_ZONE = 'Asia/Manila';

/** Matches the auth-context cache: long enough to be free, short enough to notice. */
const CACHE_TTL_MS = 30_000;

export interface ShopDateParts {
  year: number;
  /** 1-12, not the 0-11 that `Date` uses. */
  month: number;
  day: number;
}

/** True when `timeZone` is an IANA zone this runtime understands. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone });
    return true;
  } catch {
    return false;
  }
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

/**
 * `formatToParts` rather than a formatted string: `en-CA` happens to produce
 * `YYYY-MM-DD`, but relying on a locale's field order is how this breaks on a
 * runtime with different ICU data. Reading named parts cannot.
 */
function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

function readParts(instant: Date, timeZone: string): Record<string, number> {
  const parts = partsFormatter(timeZone).formatToParts(instant);
  const values: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== 'literal') values[part.type] = Number(part.value);
  }
  return values;
}

/** The calendar date an instant falls on, in the shop's zone. */
export function shopDateParts(value: string | Date, timeZone: string = DEFAULT_SHOP_TIME_ZONE): ShopDateParts {
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) {
    throw new Error('shopDateParts received a value that is not a valid instant.');
  }
  const parts = readParts(instant, timeZone);
  const { year, month, day } = parts;
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`shopDateParts could not resolve a date in "${timeZone}".`);
  }
  return { year, month, day };
}

/**
 * The calendar date an instant falls on, as `YYYY-MM-DD`, in the shop's zone.
 *
 * Returns `''` for a value that cannot be parsed, which matches what the previous
 * `String(value).slice(0, 10)` did with a missing timestamp. The point of this
 * change is the *zone*, not the failure mode: a list endpoint should not start
 * returning 500 because one row has a null timestamp.
 */
export function toShopDateKey(value: string | Date, timeZone: string = DEFAULT_SHOP_TIME_ZONE): string {
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) return '';
  const { year, month, day } = shopDateParts(instant, timeZone);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * How far ahead of UTC `timeZone` is at `instant`, in milliseconds.
 *
 * Derived by formatting the instant in the zone and reading the wall clock back
 * as if it were UTC — the difference *is* the offset. Milliseconds are dropped
 * from the instant first so the subtraction is not polluted by them.
 */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const whole = Math.floor(instant.getTime() / 1000) * 1000;
  const parts = readParts(new Date(whole), timeZone);
  // Some ICU builds report midnight as hour 24 rather than 0.
  const asUtc = Date.UTC(parts.year!, parts.month! - 1, parts.day!, (parts.hour ?? 0) % 24, parts.minute, parts.second);
  return asUtc - whole;
}

/** `YYYY-MM-DD` shifted by whole days. Pure calendar arithmetic, so it is zone-free. */
function shiftDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const shifted = new Date(Date.UTC(year!, month! - 1, day! + days));
  return shifted.toISOString().slice(0, 10);
}

/**
 * The instant the shop's day begins — 00:00 local, expressed in UTC.
 *
 * Two passes because the offset itself depends on the instant: the first guess is
 * evaluated at the naive UTC midnight, which for a zone whose offset changes near
 * that boundary lands on the wrong side of the transition. Re-reading at the
 * corrected instant converges. `Asia/Manila` has no DST, so for the current shop
 * both passes agree; the second is there so a future zone change cannot silently
 * shift the boundary by an hour.
 */
export function shopDayStart(dateKey: string, timeZone: string = DEFAULT_SHOP_TIME_ZONE): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  const naiveUtc = Date.UTC(year!, month! - 1, day!);
  let offset = zoneOffsetMs(new Date(naiveUtc), timeZone);
  offset = zoneOffsetMs(new Date(naiveUtc - offset), timeZone);
  return new Date(naiveUtc - offset);
}

/** The last millisecond of the shop's day, expressed in UTC. */
export function shopDayEnd(dateKey: string, timeZone: string = DEFAULT_SHOP_TIME_ZONE): Date {
  return new Date(shopDayStart(shiftDateKey(dateKey, 1), timeZone).getTime() - 1);
}

/** Today's date in the shop's zone, as `YYYY-MM-DD`. */
export function shopToday(timeZone: string = DEFAULT_SHOP_TIME_ZONE, now: Date = new Date()): string {
  return toShopDateKey(now, timeZone);
}

interface CachedTimeZone {
  value: string;
  expiresAt: number;
}

let cachedTimeZone: CachedTimeZone | null = null;
let warnedAboutLookupFailure = false;

/**
 * The shop's configured IANA zone, falling back to `Asia/Manila`.
 *
 * A failed or nonsensical read degrades to the default rather than throwing: a
 * missing time zone should not take down the orders list. It is logged once, not
 * per request, so a persistent misconfiguration is visible without flooding.
 */
export async function getShopTimeZone(supabase: SupabaseClient): Promise<string> {
  if (cachedTimeZone && cachedTimeZone.expiresAt > Date.now()) return cachedTimeZone.value;

  let resolved = DEFAULT_SHOP_TIME_ZONE;
  try {
    const { data } = await supabase.from('business_settings').select('time_zone').eq('id', 1).maybeSingle();
    const candidate = (data as { time_zone?: unknown } | null)?.time_zone;
    if (typeof candidate === 'string' && isValidTimeZone(candidate)) {
      resolved = candidate;
    } else if (candidate !== undefined && candidate !== null) {
      logger.warn('business_settings.time_zone is not a valid IANA zone; falling back to the default', {
        candidate,
      });
    }
  } catch (error) {
    if (!warnedAboutLookupFailure) {
      warnedAboutLookupFailure = true;
      logger.warn('The shop time zone could not be read; falling back to the default', { error });
    }
  }

  cachedTimeZone = { value: resolved, expiresAt: Date.now() + CACHE_TTL_MS };
  return resolved;
}

/**
 * Drops the cached zone. For tests, which change `business_settings` between cases
 * in one process — without this the first test's zone would leak into the rest.
 */
export function resetShopTimeZoneCache(): void {
  cachedTimeZone = null;
  warnedAboutLookupFailure = false;
}
