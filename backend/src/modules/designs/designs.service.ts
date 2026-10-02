import type { SupabaseClient } from '@supabase/supabase-js';
import type { PaginationParams, PaginatedResponse } from '@printsync/shared-types';
import { AppError } from '../../shared/errors.js';
import { calculateRange, createPaginatedResponse } from '../../shared/pagination.js';
import { getShopTimeZone, toShopDateKey } from '../../shared/shopClock.js';

export interface DesignRecord {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  createdAt: string;
  updatedAt: string;
  assetType: string | null;
  assetSizeBytes: number | null;
}

export interface DesignInput {
  name: string;
  category: string;
  imageUrl: string;
  assetType?: string | null | undefined;
  assetSizeBytes?: number | null | undefined;
}

/**
 * What an update may carry.
 *
 * The artwork columns are absent when the edit did not touch the image, which is
 * the normal case: renaming a design should not require the caller to know — or
 * to be allowed to overwrite — where the artwork is stored.
 */
export interface DesignUpdateInput {
  name: string;
  category: string;
  imageUrl?: string | undefined;
  assetType?: string | null | undefined;
  assetSizeBytes?: number | null | undefined;
}

const designSelect = 'id, name, category, image_url, created_at, updated_at, asset_type, asset_size_bytes';

function toRecord(row: Record<string, unknown>, timeZone: string): DesignRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    category: String(row.category),
    imageUrl: String(row.image_url),
    createdAt: toShopDateKey(String(row.created_at), timeZone),
    updatedAt: String(row.updated_at),
    assetType: row.asset_type ? String(row.asset_type) : null,
    assetSizeBytes: row.asset_size_bytes == null ? null : Number(row.asset_size_bytes),
  };
}

export async function listDesigns(
  supabase: SupabaseClient,
  params: PaginationParams,
): Promise<PaginatedResponse<DesignRecord>> {
  const { start, end } = calculateRange(params.page, params.limit);
  const { data, error, count } = await supabase
    .from('designs')
    .select(designSelect, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(start, end);
  if (error) throw new AppError(503, 'DESIGNS_LOOKUP_FAILED', 'Designs could not be loaded.');
  const timeZone = await getShopTimeZone(supabase);
  return createPaginatedResponse(data.map((row) => toRecord(row, timeZone)), count ?? 0, params.page, params.limit);
}

export async function createDesign(
  supabase: SupabaseClient,
  input: DesignInput,
  actorId: string,
): Promise<DesignRecord> {
  const { data, error } = await supabase
    .from('designs')
    .insert({
      name: input.name,
      category: input.category,
      image_url: input.imageUrl,
      asset_type: input.assetType ?? null,
      asset_size_bytes: input.assetSizeBytes ?? null,
      created_by: actorId,
    })
    .select(designSelect)
    .single();
  if (error || !data) throw new AppError(400, 'DESIGN_CREATE_FAILED', 'The design could not be created.');
  return toRecord(data, await getShopTimeZone(supabase));
}

export async function updateDesign(supabase: SupabaseClient, id: string, input: DesignUpdateInput): Promise<DesignRecord> {
  /*
   * Only the columns actually sent are written. `image_url` is `not null`, so
   * writing a missing one as `null` would fail the constraint rather than leave
   * it alone — and writing the asset metadata as `null` on a name-only edit
   * would silently erase the record of what was uploaded.
   */
  const patch: Record<string, unknown> = { name: input.name, category: input.category };
  if (input.imageUrl !== undefined) patch.image_url = input.imageUrl;
  if (input.assetType !== undefined) patch.asset_type = input.assetType;
  if (input.assetSizeBytes !== undefined) patch.asset_size_bytes = input.assetSizeBytes;

  const { data, error } = await supabase
    .from('designs')
    .update(patch)
    .eq('id', id)
    .select(designSelect)
    .single();
  if (error || !data) throw new AppError(404, 'DESIGN_NOT_FOUND', 'The design was not found.');
  return toRecord(data, await getShopTimeZone(supabase));
}

export async function deleteDesign(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('designs').delete().eq('id', id);
  if (error) throw new AppError(404, 'DESIGN_DELETE_FAILED', 'The design could not be deleted.');
}