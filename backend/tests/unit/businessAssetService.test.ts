import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  sweepOrphanedBusinessLogos,
  sweepOrphanedBusinessLogosSafely,
  BUSINESS_ASSET_BUCKET,
  ORPHAN_RETENTION_MS,
} from '../../src/services/businessAssetService.js';
import { DESIGN_ASSET_BUCKET } from '../../src/services/designAssetService.js';
import { createFakeSupabase, FakeSupabase, type FakeBucketObject } from './helpers/fakeSupabase.js';

/**
 * The sweep is the one place in the codebase that *deletes* user data, so these
 * tests are written to pin down what it refuses to delete at least as carefully
 * as what it removes.
 */

const BUCKET_URL = `https://fake.supabase.co/storage/v1/object/public/${BUSINESS_ASSET_BUCKET}`;
const publicUrlFor = (path: string): string => `${BUCKET_URL}/${path}`;

/** A fixed clock, so the age boundary is exact instead of wall-clock flaky. */
const NOW = new Date('2026-09-15T12:00:00.000Z');

const isoDaysAgo = (days: number): string => new Date(NOW.getTime() - days * 86_400_000).toISOString();
const isoHoursAgo = (hours: number): string => new Date(NOW.getTime() - hours * 3_600_000).toISOString();

interface SeededObject {
  /** Full object path, e.g. `actor-1/logo.png`. */
  path: string;
  /** ISO timestamp; `null` models a listing with no usable age. Defaults to two days old. */
  createdAt?: string | null;
}

/**
 * A bucket whose listing mirrors Storage's shape: `list('')` returns one
 * directory entry per actor, and each directory returns its own objects. The
 * sweep walks both levels, so the fake models both — a service that forgot to
 * descend would find nothing and silently delete nothing.
 */
function bucketWith(objects: SeededObject[]): FakeSupabase {
  const db = createFakeSupabase().onBucket(BUSINESS_ASSET_BUCKET);

  const byDirectory = new Map<string, FakeBucketObject[]>();
  for (const object of objects) {
    const slash = object.path.indexOf('/');
    assert.notEqual(slash, -1, `seed paths must be "<actor>/<file>", received "${object.path}"`);
    const directory = object.path.slice(0, slash);
    const name = object.path.slice(slash + 1);

    const entries = byDirectory.get(directory) ?? [];
    entries.push({
      name,
      created_at: object.createdAt === undefined ? isoDaysAgo(2) : object.createdAt,
      metadata: { size: 1024 },
    });
    byDirectory.set(directory, entries);
  }

  db.onBucketContents(
    BUSINESS_ASSET_BUCKET,
    '',
    [...byDirectory.keys()].map((name) => ({ name, metadata: null })),
  );
  for (const [directory, entries] of byDirectory) {
    db.onBucketContents(BUSINESS_ASSET_BUCKET, directory, entries);
  }
  return db;
}

const sweep = (db: FakeSupabase, currentLogoUrl: string | null) =>
  sweepOrphanedBusinessLogos(db.client, currentLogoUrl, { now: NOW });

describe('businessAssetService', () => {
  describe('sweepOrphanedBusinessLogos', () => {
    it('removes aged objects the settings row no longer references', async () => {
      const db = bucketWith([{ path: 'actor-1/old.png' }, { path: 'actor-1/current.png' }]);

      const result = await sweep(db, publicUrlFor('actor-1/current.png'));

      assert.deepEqual(result.deleted, ['actor-1/old.png']);
      assert.equal(result.retained, 1);
      assert.deepEqual(db.removedPathsFor(BUSINESS_ASSET_BUCKET), ['actor-1/old.png']);
    });

    it('keeps the object the settings row still points at, however old', async () => {
      const db = bucketWith([{ path: 'actor-1/current.png', createdAt: isoDaysAgo(365) }]);

      const result = await sweep(db, publicUrlFor('actor-1/current.png'));

      assert.deepEqual(result.deleted, []);
      assert.equal(result.retained, 1);
      assert.equal(db.storageRemovals.length, 0);
    });

    it('keeps an object inside the retention window', async () => {
      const db = bucketWith([{ path: 'actor-1/recent.png', createdAt: isoHoursAgo(1) }]);

      const result = await sweep(db, null);

      // The bucket serves a one-hour CDN cache, so a just-replaced logo can still
      // be requested by a page that loaded it seconds ago.
      assert.deepEqual(result.deleted, []);
      assert.equal(result.retained, 1);
      assert.equal(db.storageRemovals.length, 0);
    });

    it('deletes an object sitting exactly on the retention boundary', async () => {
      const db = bucketWith([{ path: 'actor-1/edge.png', createdAt: new Date(NOW.getTime() - ORPHAN_RETENTION_MS).toISOString() }]);

      const result = await sweep(db, null);

      assert.deepEqual(result.deleted, ['actor-1/edge.png']);
    });

    it('never deletes an object whose age is unknown', async () => {
      const db = bucketWith([{ path: 'actor-1/undated.png', createdAt: null }]);

      const result = await sweep(db, null);

      // A malformed or partial listing must not be able to cause a premature delete.
      assert.deepEqual(result.deleted, []);
      assert.equal(result.retained, 1);
      assert.equal(db.storageRemovals.length, 0);
    });

    it('walks every actor directory, not just the first', async () => {
      const db = bucketWith([
        { path: 'actor-1/old.png' },
        { path: 'actor-2/old.png' },
        { path: 'actor-2/current.png' },
      ]);

      const result = await sweep(db, publicUrlFor('actor-2/current.png'));

      assert.deepEqual([...result.deleted].sort(), ['actor-1/old.png', 'actor-2/old.png']);
      assert.equal(result.retained, 1);
    });

    it('leaves the bucket alone when every object is still referenced or too young', async () => {
      const db = bucketWith([
        { path: 'actor-1/current.png' },
        { path: 'actor-1/recent.png', createdAt: isoHoursAgo(2) },
      ]);

      const result = await sweep(db, publicUrlFor('actor-1/current.png'));

      assert.deepEqual(result.deleted, []);
      assert.equal(result.retained, 2);
      // No empty `remove([])` call: a no-op sweep must not reach Storage at all.
      assert.equal(db.storageRemovals.length, 0);
    });

    it('handles an empty bucket', async () => {
      const db = bucketWith([]);

      const result = await sweep(db, null);

      assert.deepEqual(result, { deleted: [], retained: 0 });
      assert.equal(db.storageRemovals.length, 0);
    });

    it('follows the listing pagination past the first page', async () => {
      const objects = Array.from({ length: 150 }, (_unused, index) => ({
        path: `actor-1/logo-${String(index).padStart(3, '0')}.png`,
      }));
      const db = bucketWith(objects);

      const result = await sweep(db, null);

      // 150 > the 100-entry page size, so a service that ignored `offset` would
      // stop at 100 and quietly leak the remaining 50.
      assert.equal(result.deleted.length, 150);
      const offsets = db.storageListings
        .filter((listing) => listing.prefix === 'actor-1')
        .map((listing) => listing.options?.offset);
      assert.deepEqual(offsets, [0, 100]);
    });

    it('refuses to sweep a listing that hits the page ceiling', async () => {
      const objects = Array.from({ length: 1000 }, (_unused, index) => ({
        path: `actor-1/logo-${String(index).padStart(4, '0')}.png`,
      }));
      const db = bucketWith(objects);

      // A truncated view could hide the current logo, so the sweep must abort
      // rather than delete from an incomplete picture of the bucket.
      await assert.rejects(() => sweep(db, null), /exceeded 1000 entries/);
      assert.equal(db.storageRemovals.length, 0);
    });

    it('throws when the listing fails, removing nothing', async () => {
      const db = createFakeSupabase().onBucket(BUSINESS_ASSET_BUCKET, {
        listError: { message: 'network unreachable' },
      });

      await assert.rejects(() => sweep(db, null), /Could not list/);
      assert.equal(db.storageRemovals.length, 0);
    });

    it('surfaces a Storage removal failure', async () => {
      const db = bucketWith([{ path: 'actor-1/old.png' }]);
      db.onBucket(BUSINESS_ASSET_BUCKET, { removeError: { message: 'permission denied' } });

      await assert.rejects(() => sweep(db, null), /Could not remove 1 orphaned logo object/);
    });

    it('treats a logo URL that is not a Storage object as "nothing to keep"', async () => {
      const db = bucketWith([{ path: 'actor-1/old.png' }]);

      // The bundled fallback is a same-origin path, so the sweep has no object to
      // protect and every aged object is fair game.
      const result = await sweep(db, '/brand-logo.png');

      assert.deepEqual(result.deleted, ['actor-1/old.png']);
    });

    it('only ever touches the business-assets bucket', async () => {
      const db = bucketWith([{ path: 'actor-1/old.png' }]);
      // Configured so a stray cross-bucket call would resolve instead of throwing.
      db.onBucket(DESIGN_ASSET_BUCKET);

      await sweep(db, null);

      assert.equal(
        db.storageListings.some((listing) => listing.bucket === DESIGN_ASSET_BUCKET),
        false,
      );
      assert.equal(db.storageRemovals.every((removal) => removal.bucket === BUSINESS_ASSET_BUCKET), true);
    });

    it('honours a retention override', async () => {
      const db = bucketWith([{ path: 'actor-1/old.png', createdAt: isoHoursAgo(2) }]);

      const result = await sweepOrphanedBusinessLogos(db.client, null, {
        now: NOW,
        retentionMs: 60 * 60 * 1000,
      });

      assert.deepEqual(result.deleted, ['actor-1/old.png']);
    });

    it('keeps a 24 hour window, comfortably above the one hour CDN cache', () => {
      assert.equal(ORPHAN_RETENTION_MS, 24 * 60 * 60 * 1000);
      assert.ok(ORPHAN_RETENTION_MS > 60 * 60 * 1000);
    });
  });

  describe('sweepOrphanedBusinessLogosSafely', () => {
    it('resolves even when the sweep fails', async () => {
      const db = createFakeSupabase().onBucket(BUSINESS_ASSET_BUCKET, {
        listError: { message: 'network unreachable' },
      });

      // Housekeeping is not the write the caller asked for, so it must never turn
      // a successful logo change into a 5xx.
      await assert.doesNotReject(() => sweepOrphanedBusinessLogosSafely(db.client, null));
    });

    it('resolves on a successful sweep', async () => {
      // The wrapper uses the real clock, so this object is dated unambiguously in
      // the past rather than relative to the fixed test clock above.
      const db = bucketWith([{ path: 'actor-1/old.png', createdAt: '2020-01-01T00:00:00.000Z' }]);

      await assert.doesNotReject(() => sweepOrphanedBusinessLogosSafely(db.client, null));
      assert.deepEqual(db.removedPathsFor(BUSINESS_ASSET_BUCKET), ['actor-1/old.png']);
    });
  });
});
