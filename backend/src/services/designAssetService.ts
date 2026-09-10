import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../shared/errors.js';

const MAX_ASSET_BYTES = 5 * 1024 * 1024;
const allowedContentTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);

interface UploadAssetInput {
  dataUrl: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

interface UploadedAsset {
  imageUrl: string;
  assetType: string;
  assetSizeBytes: number;
}

export async function uploadDesignAsset(
  supabase: SupabaseClient,
  input: UploadAssetInput,
  actorId: string,
): Promise<UploadedAsset> {
  if (!allowedContentTypes.has(input.contentType) || input.sizeBytes > MAX_ASSET_BYTES) {
    throw new AppError(400, 'INVALID_DESIGN_ASSET', 'Use a PNG, JPG, WebP, or SVG image up to 5 MB.');
  }

  const match = input.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  const encodedData = match?.[2];
  if (!match || !encodedData || match[1] !== input.contentType) {
    throw new AppError(400, 'INVALID_DESIGN_ASSET', 'The uploaded image data is invalid.');
  }

  const buffer = Buffer.from(encodedData, 'base64');
  if (buffer.length === 0 || buffer.length > MAX_ASSET_BYTES) {
    throw new AppError(400, 'INVALID_DESIGN_ASSET', 'The uploaded image is empty or exceeds 5 MB.');
  }

  const extension = input.contentType === 'image/jpeg' ? 'jpg' : input.contentType.split('/')[1];
  const path = `${actorId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from('design-assets').upload(path, buffer, {
    contentType: input.contentType,
    upsert: false,
  });
  if (error) throw new AppError(503, 'DESIGN_ASSET_UPLOAD_FAILED', 'The design image could not be uploaded.');

  const { data } = supabase.storage.from('design-assets').getPublicUrl(path);
  return { imageUrl: data.publicUrl, assetType: input.contentType, assetSizeBytes: buffer.length };
}