import type { SupabaseClient } from '@supabase/supabase-js';
import type { InventoryItem, PaginationParams, PaginatedResponse } from '@printsync/shared-types';
import { AppError } from '../../shared/errors.js';
import { calculateRange, createPaginatedResponse } from '../../shared/pagination.js';

/**
 * Re-exported so existing importers keep their path, but the shape itself now
 * comes from the contract.
 *
 * This file used to declare its own `InventoryItem`. Nothing imported it — every
 * consumer took the shared type — so it was a silent second copy of a contract
 * that is supposed to exist once, and it had already drifted: adding `uom` to
 * `packages/shared-types` changed the contract and left this copy behind, which
 * is what made `tsc` reject the mapper below. A duplicate definition that nobody
 * imports is still a duplicate that can disagree.
 */
export type { InventoryItem };

export interface InventoryInput {
  sku?: string | undefined;
  name: string;
  category: string;
  stock?: number | undefined;
  reorderLevel: number;
  price: number;
  costPrice?: number | undefined;
  /** Defaults to 'pc' on create; on update, omitted means "leave it alone". */
  uom?: string | undefined;
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
    // The column is `not null default 'pc'`, so this only guards a row read
    // through a path that did not select it. Falling back to the same default
    // keeps the contract's non-null promise rather than leaking an undefined.
    uom: row.uom ? String(row.uom) : 'pc',
    imageUrl: row.image_url ? String(row.image_url) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listInventory(
  supabase: SupabaseClient,
  params: PaginationParams,
  lowStock = false,
): Promise<PaginatedResponse<InventoryItem>> {
  const { start, end } = calculateRange(params.page, params.limit);
  /*
   * `count: 'exact'` makes `total` the *filtered* count: PostgREST applies the
   * filter to the counted query, not merely to the rows it returns. That is the
   * same rule Phase 4 put on `GET /orders`, and it is what keeps the pager honest
   * when the Low stock card opens this list — a total that counted the whole table
   * would offer pages that cannot exist.
   *
   * The low-stock predicate is `stock <= reorder_level`. PostgREST cannot compare
   * two columns through its filter DSL, so the expression is materialised as the
   * generated column `is_low_stock` (migration
   * 20260924000300_inventory_low_stock_flag.sql), which is exactly what
   * `get_orders_summary` counts. That is why this list's low-stock total and the
   * summary's `lowStock` field must always agree — and the live cross-check
   * asserts they do.
   */
  let query = supabase
    .from('inventory_items')
    .select('id, sku, name, category, stock, reorder_level, price, cost_price, uom, image_url, created_at, updated_at', { count: 'exact' })
    .order('name');
  if (lowStock) query = query.eq('is_low_stock', true);
  const { data, error, count } = await query.range(start, end);
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
      uom: input.uom ?? 'pc',
      image_url: input.imageUrl ?? null,
    })
    .select('id, sku, name, category, stock, reorder_level, price, cost_price, uom, image_url, created_at, updated_at')
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
      // Omitted means "leave the unit alone", matching how `sku` is handled
      // above. Every other field here is written unconditionally, but a unit is
      // not something a caller that has never heard of units should silently
      // reset to the default.
      ...(input.uom !== undefined ? { uom: input.uom } : {}),
      image_url: input.imageUrl ?? null,
    })
    .eq('id', id)
    .select('id, sku, name, category, stock, reorder_level, price, cost_price, uom, image_url, created_at, updated_at')
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

export async function exportInventory(supabase: SupabaseClient): Promise<InventoryItem[]> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('id, sku, name, category, stock, reorder_level, price, cost_price, uom, image_url, created_at, updated_at')
    .order('name');
  if (error) throw new AppError(503, 'INVENTORY_LOOKUP_FAILED', 'Inventory could not be loaded.');
  return data.map((row) => toItem(row));
}