import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../shared/errors.js';

/**
 * Shared Supabase Storage upload path for browser-supplied images.
 *
 * Design artwork and the business logo need identical treatment: take a base64
 * data URL from the browser, validate the declared content type and the *decoded*
 * byte length, write the bytes into a public bucket, and return the public URL.
 * The only real differences are the bucket, the size ceiling and the error codes,
 * so those arrive as a `StorageImageTarget` and everything else lives here.
 *
 * Callers keep their own thin wrappers (`designAssetService`,
 * `businessAssetService`) so their error codes stay domain-specific and the
 * buckets stay named in one obvious place.
 */

/** Content types Storage will accept for an uploaded image. */
export const ALLOWED_IMAGE_CONTENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
] as const;

const allowedContentTypes = new Set<string>(ALLOWED_IMAGE_CONTENT_TYPES);

export interface ImageUploadInput {
  dataUrl: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface UploadedImage {
  /** Public URL the browser can render directly. */
  imageUrl: string;
  assetType: string;
  /** Real decoded size, which is authoritative over the client-declared value. */
  assetSizeBytes: number;
}

export interface StorageImageTarget {
  /** Bucket id, e.g. `business-assets`. */
  bucket: string;
  /** Ceiling for a single upload in bytes; mirrored by the bucket's own limit. */
  maxBytes: number;
  /** Error code for a request the caller can fix (wrong type, too large, bad payload). */
  invalidCode: string;
  /** Error code for a Storage-side failure the caller cannot fix. */
  uploadFailedCode: string;
  /** How the accepted formats and ceiling are described back to the caller. */
  requirement: string;
  /** Used in the Storage failure message, e.g. `business logo`. */
  label: string;
}

/** `2 MB` / `1.5 MB` — keeps size messages readable for non-round ceilings. */
function formatMegabytes(bytes: number): string {
  const megabytes = bytes / (1024 * 1024);
  return `${Number.isInteger(megabytes) ? megabytes : megabytes.toFixed(1)} MB`;
}

export async function uploadStorageImage(
  supabase: SupabaseClient,
  input: ImageUploadInput,
  actorId: string,
  target: StorageImageTarget,
): Promise<UploadedImage> {
  const { bucket, maxBytes, invalidCode, uploadFailedCode, requirement, label } = target;

  if (!allowedContentTypes.has(input.contentType) || input.sizeBytes > maxBytes) {
    throw new AppError(400, invalidCode, requirement);
  }

  const match = input.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  const encodedData = match?.[2];
  if (!match || !encodedData || match[1] !== input.contentType) {
    throw new AppError(400, invalidCode, 'The uploaded image data is invalid.');
  }

  // Decoding is the only way to know the true size; `sizeBytes` is client-supplied
  // and a base64 payload is ~33% larger than the bytes it represents.
  const buffer = Buffer.from(encodedData, 'base64');
  if (buffer.length === 0 || buffer.length > maxBytes) {
    throw new AppError(400, invalidCode, `The uploaded image is empty or exceeds ${formatMegabytes(maxBytes)}.`);
  }

  const extension = input.contentType === 'image/jpeg' ? 'jpg' : input.contentType.split('/')[1];
  // Namespacing by actor keeps one user's uploads grouped and makes a per-actor
  // cleanup policy possible later without a schema change.
  const path = `${actorId}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType: input.contentType,
    upsert: false,
  });
  if (error) throw new AppError(503, uploadFailedCode, `The ${label} could not be uploaded.`);

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { imageUrl: data.publicUrl, assetType: input.contentType, assetSizeBytes: buffer.length };
}

/** Marks the object path inside a Supabase public object URL. */
const PUBLIC_URL_MARKER = '/object/public/';

/**
 * Inverse of `getPublicUrl`: recover the object path a public URL points at.
 *
 * Returns `null` when the value is not a public URL for `bucket` — a legacy
 * externally-hosted URL, or the bundled `/brand-logo.png` fallback. Callers use
 * that to decide whether a stored URL refers to an object they may manage.
 *
 * Lives next to `getPublicUrl` so the two halves of the URL contract cannot drift.
 */
export function objectPathFromPublicUrl(bucket: string, url: string | null): string | null {
  if (!url) return null;

  const marker = `${PUBLIC_URL_MARKER}${bucket}/`;
  const markerIndex = url.indexOf(marker);
  if (markerIndex === -1) return null;

  const withoutQuery = url.slice(markerIndex + marker.length).split('?')[0];
  if (!withoutQuery) return null;

  try {
    return decodeURIComponent(withoutQuery);
  } catch {
    // A malformed escape sequence is not worth failing over; the raw path is still
    // a better answer than null.
    return withoutQuery;
  }
}
