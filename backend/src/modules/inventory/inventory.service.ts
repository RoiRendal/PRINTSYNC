import type { SupabaseClient } from '@supabase/supabase-js';
import type { PaginationParams, PaginatedResponse } from '@printsync/shared-types';
import { AppError } from '../../shared/errors.js';
import { calculateRange, createPaginatedResponse } from '../../shared/pagination.js';

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  stock: number;
  reorderLevel: number;
  price: number;
  costPrice: number;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryInput {
  sku?: string | undefined;
  name: string;
  category: string;
  stock?: number | undefined;
  reorderLevel: number;
  price: number;
  costPrice?: number | undefined;
  imageUrl?: string | null | undefined;
}

function toItem(row: Record<string, unknown>): InventoryItem {
  return {
    id: String(row.id),
    sku: String(row.sku),
    name: String(row.name),
    category: String(row.category),
    stock: Number(row.stock),
    reorderLevel: Number(row.reorder_level),
    price: Number(row.price),
    costPrice: Number(row.cost_price ?? 0),
    imageUrl: row.image_url ? String(row.image_url) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listInventory(
  supabase: SupabaseClient,
  params: PaginationParams,
): Promise<PaginatedResponse<InventoryItem>> {
  const { start, end } = calculateRange(params.page, params.limit);
  const { data, error, count } = await supabase
    .from('inventory_items')
    .select('id, sku, name, category, stock, reorder_level, price, cost_price, image_url, created_at, updated_at', { count: 'exact' })
    .order('name')
    .range(start, end);
  if (error) throw new AppError(503, 'INVENTORY_LOOKUP_FAILED', 'Inventory could not be loaded.');
  return createPaginatedResponse(data.map((row) => toItem(row)), count ?? 0, params.page, params.limit);
}

export async function createInventoryItem(
  supabase: SupabaseClient,
  input: InventoryInput,
): Promise<InventoryItem> {
  const { data, error } = await supabase
    .from('inventory_items')
    .insert({
      sku: input.sku || `INV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      name: input.name,
      category: input.category,
      stock: input.stock ?? 0,
      reorder_level: input.reorderLevel,
      price: input.price,
      cost_price: input.costPrice ?? 0,
      image_url: input.imageUrl ?? null,
    })
    .select('id, sku, name, category, stock, reorder_level, price, cost_price, image_url, created_at, updated_at')
    .single();
  if (error || !data) throw new AppError(400, 'INVENTORY_CREATE_FAILED', 'The inventory item could not be created.');
  return toItem(data);
}

export async function updateInventoryItem(
  supabase: SupabaseClient,
  id: string,
  input: Omit<InventoryInput, 'stock'>,
): Promise<InventoryItem> {
  const { data, error } = await supabase
    .from('inventory_items')
    .update({
      ...(input.sku ? { sku: input.sku } : {}),
      name: input.name,
      category: input.category,
      reorder_level: input.reorderLevel,
      price: input.price,
      cost_price: input.costPrice ?? 0,
      image_url: input.imageUrl ?? null,
    })
    .eq('id', id)
    .select('id, sku, name, category, stock, reorder_level, price, cost_price, image_url, created_at, updated_at')
    .single();
  if (error || !data) throw new AppError(404, 'INVENTORY_NOT_FOUND', 'The inventory item was not found.');
  return toItem(data);
}

export async function deleteInventoryItem(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('inventory_items').delete().eq('id', id);
  if (error) throw new AppError(404, 'INVENTORY_DELETE_FAILED', 'The inventory item could not be deleted.');
}

export async function adjustInventoryStock(
  supabase: SupabaseClient,
  id: string,
  quantity: number,
  reason: string,
  actorId: string,
): Promise<InventoryItem> {
  const { data, error } = await supabase.rpc('adjust_inventory_stock', {
    p_item_id: id,
    p_quantity: quantity,
    p_reason: reason,
    p_actor_id: actorId,
  });
  if (error || !data) throw new AppError(400, 'INVENTORY_ADJUSTMENT_FAILED', 'The inventory stock could not be adjusted.');
  return toItem(data as Record<string, unknown>);
}