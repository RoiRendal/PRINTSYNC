import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../shared/errors.js';

export interface DesignRecord {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  assetType: string | null;
  assetSizeBytes: number | null;
}

export interface DesignInput {
  name: string;
  category: string;
  imageUrl: string;
  tags: string[];
  assetType?: string | null | undefined;
  assetSizeBytes?: number | null | undefined;
}

const designSelect = 'id, name, category, image_url, created_at, updated_at, tags, asset_type, asset_size_bytes';

function toRecord(row: Record<string, unknown>): DesignRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    category: String(row.category),
    imageUrl: String(row.image_url),
    createdAt: String(row.created_at).slice(0, 10),
    updatedAt: String(row.updated_at),
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    assetType: row.asset_type ? String(row.asset_type) : null,
    assetSizeBytes: row.asset_size_bytes == null ? null : Number(row.asset_size_bytes),
  };
}

export async function listDesigns(supabase: SupabaseClient): Promise<DesignRecord[]> {
  const { data, error } = await supabase.from('designs').select(designSelect).order('created_at', { ascending: false });
  if (error) throw new AppError(503, 'DESIGNS_LOOKUP_FAILED', 'Designs could not be loaded.');
  return data.map((row) => toRecord(row));
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
      tags: input.tags,
      asset_type: input.assetType ?? null,
      asset_size_bytes: input.assetSizeBytes ?? null,
      created_by: actorId,
    })
    .select(designSelect)
    .single();
  if (error || !data) throw new AppError(400, 'DESIGN_CREATE_FAILED', 'The design could not be created.');
  return toRecord(data);
}

export async function updateDesign(supabase: SupabaseClient, id: string, input: DesignInput): Promise<DesignRecord> {
  const { data, error } = await supabase
    .from('designs')
    .update({
      name: input.name,
      category: input.category,
      image_url: input.imageUrl,
      tags: input.tags,
      asset_type: input.assetType ?? null,
      asset_size_bytes: input.assetSizeBytes ?? null,
    })
    .eq('id', id)
    .select(designSelect)
    .single();
  if (error || !data) throw new AppError(404, 'DESIGN_NOT_FOUND', 'The design was not found.');
  return toRecord(data);
}

export async function deleteDesign(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('designs').delete().eq('id', id);
  if (error) throw new AppError(404, 'DESIGN_DELETE_FAILED', 'The design could not be deleted.');
}