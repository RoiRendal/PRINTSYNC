import type { SupabaseClient } from '@supabase/supabase-js';
import { uploadStorageImage, type ImageUploadInput, type UploadedImage } from './imageAssetService.js';

/**
 * Stock item photo uploads. The bucket, ceiling and error codes are the only
 * inventory-specific parts; the validation and the Storage write live in
 * `imageAssetService`.
 *
 * This exists because `inventory_items.image_url` used to hold a base64 data URL
 * written straight from the browser, and the list endpoint selects that column on
 * every row — so every inventory fetch shipped every photo. Only the resulting
 * public URL is persisted now.
 */

/**
 * A stock photo is only ever drawn as a gallery tile or a modal preview, never at
 * print size, so it keeps the smaller ceiling. Design artwork gets 5 MB because
 * it really is produced at print resolution; a material photo is not.
 */
export const MAX_INVENTORY_IMAGE_BYTES = 2 * 1024 * 1024;

export const INVENTORY_ASSET_BUCKET = 'inventory-assets';

export type UploadInventoryImageInput = ImageUploadInput;
export type UploadedInventoryImage = UploadedImage;

export async function uploadInventoryImage(
  supabase: SupabaseClient,
  input: UploadInventoryImageInput,
  actorId: string,
): Promise<UploadedInventoryImage> {
  return uploadStorageImage(supabase, input, actorId, {
    bucket: INVENTORY_ASSET_BUCKET,
    maxBytes: MAX_INVENTORY_IMAGE_BYTES,
    invalidCode: 'INVALID_INVENTORY_ASSET',
    uploadFailedCode: 'INVENTORY_ASSET_UPLOAD_FAILED',
    requirement: 'Use a PNG, JPG, WebP, or SVG image up to 2 MB.',
    label: 'stock photo',
  });
}
