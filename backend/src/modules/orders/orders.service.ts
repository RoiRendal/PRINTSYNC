import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../shared/errors.js';

export type OrderStatus = 'Pending' | 'In Production' | 'Ready for Pickup' | 'Designing' | 'Completed' | 'Delivered';

export interface OrderLineItem {
  itemId?: string | undefined;
  name: string;
  quantity: number;
  designId?: string | undefined;
  unitPrice: number;
}

export interface OrderRecord {
  id: string;
  customer: string;
  item: string;
  lineItems: OrderLineItem[];
  quantity: number;
  status: OrderStatus;
  date: string;
  amount: number;
  designId?: string | undefined;
  notes: string;
  isCustom: boolean;
}

export interface OrderInput {
  customer: string;
  lineItems: OrderLineItem[];
  amount: number;
  status?: OrderStatus | undefined;
  notes?: string | undefined;
  isCustom?: boolean | undefined;
}

export interface OrderUpdateInput {
  customer?: string | undefined;
  lineItems?: OrderLineItem[] | undefined;
  amount?: number | undefined;
  status?: OrderStatus | undefined;
  notes?: string | undefined;
  isCustom?: boolean | undefined;
}

const orderSelect = 'id, customer, status, amount, notes, is_custom, created_at, updated_at';

function toRecord(row: Record<string, unknown>, items: OrderLineItem[]): OrderRecord {
  return {
    id: String(row.id),
    customer: String(row.customer),
    item: items.map((item) => item.name).join(', '),
    lineItems: items,
    quantity: items.reduce((total, item) => total + item.quantity, 0),
    status: String(row.status) as OrderStatus,
    date: String(row.created_at).slice(0, 10),
    amount: Number(row.amount),
    designId: items.find((item) => item.designId)?.designId,
    notes: String(row.notes ?? ''),
    isCustom: Boolean(row.is_custom),
  };
}

async function loadItems(supabase: SupabaseClient, orderIds: string[]): Promise<Map<string, OrderLineItem[]>> {
  const result = new Map<string, OrderLineItem[]>();
  if (orderIds.length === 0) return result;
  const { data, error } = await supabase
    .from('order_items')
    .select('order_id, inventory_item_id, design_id, name, quantity, unit_price')
    .in('order_id', orderIds)
    .order('id');
  if (error) throw new AppError(503, 'ORDER_ITEMS_LOOKUP_FAILED', 'Order items could not be loaded.');
  for (const row of data) {
    const items = result.get(String(row.order_id)) ?? [];
    items.push({
      itemId: row.inventory_item_id ? String(row.inventory_item_id) : undefined,
      designId: row.design_id ? String(row.design_id) : undefined,
      name: String(row.name),
      quantity: Number(row.quantity),
      unitPrice: Number(row.unit_price),
    });
    result.set(String(row.order_id), items);
  }
  return result;
}

async function mapOrders(supabase: SupabaseClient, rows: Record<string, unknown>[]): Promise<OrderRecord[]> {
  const itemMap = await loadItems(supabase, rows.map((row) => String(row.id)));
  return rows.map((row) => toRecord(row, itemMap.get(String(row.id)) ?? []));
}

export async function listOrders(supabase: SupabaseClient): Promise<OrderRecord[]> {
  const { data, error } = await supabase.from('orders').select(orderSelect).order('created_at', { ascending: false });
  if (error) throw new AppError(503, 'ORDERS_LOOKUP_FAILED', 'Orders could not be loaded.');
  return mapOrders(supabase, data);
}

export async function getOrder(supabase: SupabaseClient, id: string): Promise<OrderRecord> {
  const { data, error } = await supabase.from('orders').select(orderSelect).eq('id', id).maybeSingle();
  if (error || !data) throw new AppError(404, 'ORDER_NOT_FOUND', 'The order was not found.');
  const [order] = await mapOrders(supabase, [data]);
  return order as OrderRecord;
}

export async function createOrder(supabase: SupabaseClient, input: OrderInput, actorId: string): Promise<OrderRecord> {
  const { data, error } = await supabase.rpc('create_order_with_items', {
    p_customer: input.customer,
    p_status: input.status ?? 'Pending',
    p_amount: input.amount,
    p_notes: input.notes ?? '',
    p_is_custom: input.isCustom ?? false,
    p_created_by: actorId,
    p_items: input.lineItems,
  });
  if (error || !data) throw new AppError(400, 'ORDER_CREATE_FAILED', error?.message ?? 'The order could not be created.');
  return getOrder(supabase, String((data as Record<string, unknown>).id));
}

export async function updateOrder(supabase: SupabaseClient, id: string, input: OrderUpdateInput, actorId: string): Promise<OrderRecord> {
  if (input.lineItems !== undefined) {
    const existing = await getOrder(supabase, id);
    const { data, error } = await supabase.rpc('replace_order_with_items', {
      p_order_id: id,
      p_customer: input.customer ?? existing.customer,
      p_status: input.status ?? existing.status,
      p_amount: input.amount ?? existing.amount,
      p_notes: input.notes ?? existing.notes,
      p_is_custom: input.isCustom ?? existing.isCustom,
      p_items: input.lineItems,
      p_actor_id: actorId,
    });
    if (error || !data) throw new AppError(400, 'ORDER_UPDATE_FAILED', error?.message ?? 'The order could not be updated.');
    return getOrder(supabase, id);
  }

  const updates: Record<string, unknown> = {};
  if (input.customer !== undefined) updates.customer = input.customer;
  if (input.status !== undefined) updates.status = input.status;
  if (input.amount !== undefined) updates.amount = input.amount;
  if (input.notes !== undefined) updates.notes = input.notes;
  if (input.isCustom !== undefined) updates.is_custom = input.isCustom;
  const { data, error } = await supabase.from('orders').update(updates).eq('id', id).select(orderSelect).maybeSingle();
  if (error || !data) throw new AppError(404, 'ORDER_NOT_FOUND', 'The order was not found.');
  return getOrder(supabase, String(data.id));
}

export async function deleteOrder(supabase: SupabaseClient, id: string, actorId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_order_with_items', { p_order_id: id, p_actor_id: actorId });
  if (error) throw new AppError(404, 'ORDER_DELETE_FAILED', error.message || 'The order could not be deleted.');
}