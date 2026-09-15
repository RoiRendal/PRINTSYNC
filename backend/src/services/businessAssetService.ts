import type { SupabaseClient } from '@supabase/supabase-js';
import { uploadStorageImage, type ImageUploadInput, type UploadedImage } from './imageAssetService.js';

/**
 * Business branding uploads (currently just the company logo).
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
