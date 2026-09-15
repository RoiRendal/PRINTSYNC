import type { SupabaseClient } from '@supabase/supabase-js';
import { uploadStorageImage, type ImageUploadInput, type UploadedImage } from './imageAssetService.js';

/**
 * Design artwork uploads. The bucket, ceiling and error codes are the only
 * design-specific parts; the validation and Storage write live in
 * `imageAssetService`.
 */

/** Design artwork may be print-resolution, so it keeps a larger ceiling than a logo. */
const MAX_ASSET_BYTES = 5 * 1024 * 1024;

export const DESIGN_ASSET_BUCKET = 'design-assets';

export type UploadAssetInput = ImageUploadInput;
export type UploadedAsset = UploadedImage;

export async function uploadDesignAsset(
  supabase: SupabaseClient,
  input: UploadAssetInput,
  actorId: string,
): Promise<UploadedAsset> {
  return uploadStorageImage(supabase, input, actorId, {
    bucket: DESIGN_ASSET_BUCKET,
    maxBytes: MAX_ASSET_BYTES,
    invalidCode: 'INVALID_DESIGN_ASSET',
    uploadFailedCode: 'DESIGN_ASSET_UPLOAD_FAILED',
    requirement: 'Use a PNG, JPG, WebP, or SVG image up to 5 MB.',
    label: 'design image',
  });
}
