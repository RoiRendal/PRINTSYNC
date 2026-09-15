import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../shared/logger.js';
import {
  objectPathFromPublicUrl,
  uploadStorageImage,
  type ImageUploadInput,
  type UploadedImage,
} from './imageAssetService.js';

/**
 * Business branding uploads (currently just the company logo) and the lifecycle
 * housekeeping that goes with them.
 *
 * Logos render in the app header, the login screen and reports, so they are
 * deliberately smaller than design artwork. The ceiling mirrors the
 * `business-assets` bucket's own `file_size_limit`, which means an oversized file
 * is rejected with a clear 400 here instead of an opaque Storage error.
 */

export const BUSINESS_ASSET_BUCKET = 'business-assets';
export const MAX_BUSINESS_LOGO_BYTES = 2 * 1024 * 1024;

export type UploadBusinessLogoInput = ImageUploadInput;
export type UploadedBusinessLogo = UploadedImage;

export async function uploadBusinessLogo(
  supabase: SupabaseClient,
  input: UploadBusinessLogoInput,
  actorId: string,
): Promise<UploadedBusinessLogo> {
  return uploadStorageImage(supabase, input, actorId, {
    bucket: BUSINESS_ASSET_BUCKET,
    maxBytes: MAX_BUSINESS_LOGO_BYTES,
    invalidCode: 'INVALID_BUSINESS_LOGO',
    uploadFailedCode: 'BUSINESS_LOGO_UPLOAD_FAILED',
    requirement: 'Use a PNG, JPG, WebP, or SVG logo up to 2 MB.',
    label: 'business logo',
  });
}

// ─── Orphaned object cleanup ────────────────────────────────────────

/**
 * How long an unreferenced logo object is kept before a sweep removes it.
 *
 * The bucket serves `Cache-Control: public, max-age=3600`, so a page that loaded
 * the previous logo can legitimately still request it for up to an hour. 24 hours
 * leaves a wide margin over that window while keeping the bucket from growing
 * without bound. Deleting eagerly on replace would break exactly those stale pages.
 */
export const ORPHAN_RETENTION_MS = 24 * 60 * 60 * 1000;

const LIST_PAGE_SIZE = 100;
/** Guard against an unbounded listing loop on an unexpectedly large bucket. */
const MAX_LIST_PAGES = 10;

export interface SweepOptions {
  /** Override the retention window; tests use it to exercise the age boundary. */
  retentionMs?: number | undefined;
  /** Override "now"; tests use it to age objects without waiting. */
  now?: Date | undefined;
}

export interface SweepResult {
  /** Object paths that were removed. */
  deleted: string[];
  /** How many objects were deliberately left in place (current logo, or too recent). */
  retained: number;
}

interface StorageListEntry {
  name: string;
  created_at?: string | null;
  /** `null` marks a directory in a Supabase Storage listing. */
  metadata?: Record<string, unknown> | null;
}

interface StoredObject {
  path: string;
  /** `null` when the listing omitted a usable timestamp. */
  createdAt: Date | null;
}

function toStoredObject(entry: StorageListEntry, prefix: string): StoredObject {
  const createdAt = entry.created_at ? new Date(entry.created_at) : null;
  return {
    path: prefix ? `${prefix}/${entry.name}` : entry.name,
    createdAt: createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt : null,
  };
}

/**
 * Lists every object under `prefix`, following the offset pagination.
 *
 * Uploads are namespaced by actor id, so the tree is exactly two levels deep:
 * `''` yields one directory per actor, and each directory yields the objects.
 */
async function listObjects(
  supabase: SupabaseClient,
  bucket: string,
  prefix: string,
): Promise<StoredObject[]> {
  const objects: StoredObject[] = [];

  for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: LIST_PAGE_SIZE, offset: page * LIST_PAGE_SIZE });
    if (error) {
      throw new Error(`Could not list "${prefix || '/'}" in ${bucket}: ${String(error.message ?? error)}`);
    }

    const entries = (data ?? []) as StorageListEntry[];
    for (const entry of entries) {
      if (entry.metadata == null) {
        const childPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
        objects.push(...(await listObjects(supabase, bucket, childPrefix)));
      } else {
        objects.push(toStoredObject(entry, prefix));
      }
    }

    if (entries.length < LIST_PAGE_SIZE) return objects;
  }

  throw new Error(
    `Listing ${bucket} exceeded ${MAX_LIST_PAGES * LIST_PAGE_SIZE} entries; refusing to sweep a truncated view.`,
  );
}

/**
 * Removes logo objects that nothing references any more.
 *
 * Replacing or clearing a logo leaves the previous object behind. There is no job
 * runner in this project, so rather than adding a scheduler the sweep runs lazily
 * on the next logo write — exactly when there is new garbage to consider. Objects
 * younger than the retention window are always kept, which is what makes the lazy
 * timing safe.
 *
 * Throws on a Storage failure. Callers that must not fail use
 * `sweepOrphanedBusinessLogosSafely`.
 */
export async function sweepOrphanedBusinessLogos(
  supabase: SupabaseClient,
  currentLogoUrl: string | null,
  options: SweepOptions = {},
): Promise<SweepResult> {
  const retentionMs = options.retentionMs ?? ORPHAN_RETENTION_MS;
  const now = options.now ?? new Date();
  const cutoff = now.getTime() - retentionMs;

  // The object the settings row still points at, if it lives in this bucket.
  const keepPath = objectPathFromPublicUrl(BUSINESS_ASSET_BUCKET, currentLogoUrl);

  const objects = await listObjects(supabase, BUSINESS_ASSET_BUCKET, '');
  const removable = objects.filter((object) => {
    if (object.path === keepPath) return false;
    // An unknown age is treated as "not yet safe", so a malformed listing can never
    // cause a premature delete.
    if (object.createdAt === null) return false;
    return object.createdAt.getTime() <= cutoff;
  });

  if (removable.length === 0) {
    return { deleted: [], retained: objects.length };
  }

  const paths = removable.map((object) => object.path);
  const { error } = await supabase.storage.from(BUSINESS_ASSET_BUCKET).remove(paths);
  if (error) {
    throw new Error(`Could not remove ${paths.length} orphaned logo object(s): ${String(error.message ?? error)}`);
  }

  return { deleted: paths, retained: objects.length - paths.length };
}

/**
 * Sweep for use inside a request handler.
 *
 * Housekeeping is not the write the caller asked for, so a Storage hiccup must
 * never turn a successful logo change into a 5xx. Failures are logged and
 * swallowed; the next logo write retries with a fresh listing.
 */
export async function sweepOrphanedBusinessLogosSafely(
  supabase: SupabaseClient,
  currentLogoUrl: string | null,
): Promise<void> {
  try {
    const { deleted } = await sweepOrphanedBusinessLogos(supabase, currentLogoUrl);
    if (deleted.length > 0) {
      logger.info('Removed orphaned business logo objects', { count: deleted.length, paths: deleted });
    }
  } catch (error) {
    logger.warn('Business logo orphan sweep failed', {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
