import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../shared/errors.js';

export type PaymentMethod = 'Cash' | 'Card' | 'Custom Order';
export type TransactionStatus = 'completed' | 'voided';

export interface TransactionItem {
  itemId?: string | undefined;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface TransactionRecord {
  id: string;
  status: TransactionStatus;
  items: TransactionItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentAmount: number;
  date: string;
}

export interface TransactionInput {
  items: TransactionItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentAmount: number;
}

const transactionSelect = 'id, status, subtotal, discount, tax, total, payment_method, created_at';

async function loadItems(supabase: SupabaseClient, transactionIds: string[]): Promise<Map<string, TransactionItem[]>> {
  const result = new Map<string, TransactionItem[]>();
  if (transactionIds.length === 0) return result;
  const { data, error } = await supabase
    .from('sales_transaction_items')
    .select('transaction_id, inventory_item_id, name, quantity, unit_price')
    .in('transaction_id', transactionIds)
    .order('id');
  if (error) throw new AppError(503, 'TRANSACTION_ITEMS_LOOKUP_FAILED', 'Transaction items could not be loaded.');
  for (const row of data) {
    const items = result.get(String(row.transaction_id)) ?? [];
    items.push({
      itemId: row.inventory_item_id ? String(row.inventory_item_id) : undefined,
      name: String(row.name),
      quantity: Number(row.quantity),
      unitPrice: Number(row.unit_price),
    });
    result.set(String(row.transaction_id), items);
  }
  return result;
}

async function loadPaymentAmounts(supabase: SupabaseClient, transactionIds: string[]): Promise<Map<string, number>> {
  const amounts = new Map<string, number>();
  if (transactionIds.length === 0) return amounts;
  const { data, error } = await supabase
    .from('payments')
    .select('transaction_id, amount')
    .in('transaction_id', transactionIds)
    .eq('status', 'captured');
  if (error) throw new AppError(503, 'PAYMENTS_LOOKUP_FAILED', 'Payments could not be loaded.');
  for (const row of data) amounts.set(String(row.transaction_id), Number(row.amount));
  return amounts;
}

async function mapTransactions(supabase: SupabaseClient, rows: Record<string, unknown>[]): Promise<TransactionRecord[]> {
  const ids = rows.map((row) => String(row.id));
  const [items, payments] = await Promise.all([loadItems(supabase, ids), loadPaymentAmounts(supabase, ids)]);
  return rows.map((row) => ({
    id: String(row.id),
    status: String(row.status) as TransactionStatus,
    items: items.get(String(row.id)) ?? [],
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    tax: Number(row.tax),
    total: Number(row.total),
    paymentMethod: String(row.payment_method) as PaymentMethod,
    paymentAmount: payments.get(String(row.id)) ?? 0,
    date: String(row.created_at).slice(0, 10),
  }));
}

export async function listTransactions(supabase: SupabaseClient): Promise<TransactionRecord[]> {
  const { data, error } = await supabase.from('sales_transactions').select(transactionSelect).order('created_at', { ascending: false });
  if (error) throw new AppError(503, 'TRANSACTIONS_LOOKUP_FAILED', 'Transactions could not be loaded.');
  return mapTransactions(supabase, data);
}

export async function getTransaction(supabase: SupabaseClient, id: string): Promise<TransactionRecord> {
  const { data, error } = await supabase.from('sales_transactions').select(transactionSelect).eq('id', id).maybeSingle();
  if (error || !data) throw new AppError(404, 'TRANSACTION_NOT_FOUND', 'The transaction was not found.');
  const [transaction] = await mapTransactions(supabase, [data]);
  return transaction as TransactionRecord;
}

export async function createTransaction(supabase: SupabaseClient, input: TransactionInput, actorId: string): Promise<TransactionRecord> {
  const { data, error } = await supabase.rpc('create_transaction_with_payment', {
    p_subtotal: input.subtotal,
    p_discount: input.discount,
    p_tax: input.tax,
    p_total: input.total,
    p_payment_method: input.paymentMethod,
    p_received_amount: input.paymentAmount,
    p_created_by: actorId,
    p_items: input.items,
  });
  if (error || !data) throw new AppError(400, 'TRANSACTION_CREATE_FAILED', error?.message ?? 'The transaction could not be created.');
  return getTransaction(supabase, String((data as Record<string, unknown>).id));
}

export async function voidTransaction(supabase: SupabaseClient, id: string, actorId: string): Promise<TransactionRecord> {
  const { data, error } = await supabase.rpc('void_transaction', { p_transaction_id: id, p_voided_by: actorId });
  if (error || !data) throw new AppError(400, 'TRANSACTION_VOID_FAILED', error?.message ?? 'The transaction could not be voided.');
  return getTransaction(supabase, String((data as Record<string, unknown>).id));
}