import type { SupabaseClient } from '@supabase/supabase-js';
import type { InsufficientStockDetails, PaginationParams, PaginatedResponse } from '@printsync/shared-types';
import { AppError } from '../../shared/errors.js';
import { calculateRange, createPaginatedResponse } from '../../shared/pagination.js';

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
  /**
   * Identifies this one checkout attempt. Replaying the same value returns the
   * original transaction instead of creating a second sale, which is what stops a
   * double-click or a retry after a dropped response from charging twice.
   */
  idempotencyKey: string;
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

export async function listTransactions(
  supabase: SupabaseClient,
  params: PaginationParams,
): Promise<PaginatedResponse<TransactionRecord>> {
  const { start, end } = calculateRange(params.page, params.limit);
  const { data, error, count } = await supabase
    .from('sales_transactions')
    .select(transactionSelect, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(start, end);
  if (error) throw new AppError(503, 'TRANSACTIONS_LOOKUP_FAILED', 'Transactions could not be loaded.');
  const transactions = await mapTransactions(supabase, data);
  return createPaginatedResponse(transactions, count ?? 0, params.page, params.limit);
}

export async function getTransaction(supabase: SupabaseClient, id: string): Promise<TransactionRecord> {
  const { data, error } = await supabase.from('sales_transactions').select(transactionSelect).eq('id', id).maybeSingle();
  if (error || !data) throw new AppError(404, 'TRANSACTION_NOT_FOUND', 'The transaction was not found.');
  const [transaction] = await mapTransactions(supabase, [data]);
  return transaction as TransactionRecord;
}

/**
 * Finds the sale a checkout attempt committed under `key`, if it committed at all.
 *
 * This exists to answer one question the cashier cannot otherwise answer: **did
 * my sale actually go through?** When a checkout fails without a verdict — the
 * connection dropped, the request timed out, the API answered 5xx after the
 * write landed — the till genuinely cannot tell whether the customer was
 * charged, and the natural response is to ring the sale up again. The
 * idempotency key makes that retry safe; this lookup makes it *unnecessary*,
 * because it can say what actually happened.
 *
 * Returns `null` when no sale carries the key, which is a normal answer rather
 * than an error — the caller renders it as "nothing was written, safe to retry".
 * A genuine lookup failure is different, and throws: reporting a database outage
 * as "no sale" is the one wrong answer, because it would invite a second charge.
 */
export async function findTransactionByIdempotencyKey(
  supabase: SupabaseClient,
  key: string,
): Promise<TransactionRecord | null> {
  const { data, error } = await supabase
    .from('sales_transactions')
    .select(transactionSelect)
    .eq('idempotency_key', key)
    .maybeSingle();
  if (error) throw new AppError(503, 'TRANSACTION_LOOKUP_FAILED', 'The checkout could not be verified.');
  if (!data) return null;
  const [transaction] = await mapTransactions(supabase, [data]);
  return transaction as TransactionRecord;
}

/**
 * The structured context the RPC attaches when stock runs short.
 *
 * The shape itself lives in `@printsync/shared-types` so the API that raises it
 * and the POS that renders it share one definition; this re-export keeps the
 * service's own surface unchanged.
 */
export type { InsufficientStockDetails };

function isInsufficientStockDetails(value: unknown): value is InsufficientStockDetails {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.itemId === 'string' &&
    typeof candidate.itemName === 'string' &&
    typeof candidate.available === 'number' &&
    typeof candidate.requested === 'number'
  );
}

/**
 * Turns an RPC failure into the right HTTP outcome.
 *
 * A stock shortfall is not a bad request — it was well formed and would have
 * succeeded a minute earlier — so it is a 409, and it carries the numbers the POS
 * needs to point at the offending cart line rather than showing a bare banner.
 */
function mapCreateFailure(error: { message?: string; details?: string | null } | null): AppError {
  const message = error?.message ?? 'The transaction could not be created.';

  if (typeof error?.details === 'string' && error.details.length > 0) {
    try {
      const parsed: unknown = JSON.parse(error.details);
      if (isInsufficientStockDetails(parsed)) {
        return new AppError(409, 'INSUFFICIENT_STOCK', message, parsed);
      }
    } catch {
      // `details` is not always ours — Postgres also puts constraint names there.
      // A parse failure simply means "no structured context".
    }
  }

  return new AppError(400, 'TRANSACTION_CREATE_FAILED', message);
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
    p_idempotency_key: input.idempotencyKey,
  });
  if (error || !data) throw mapCreateFailure(error);
  return getTransaction(supabase, String((data as Record<string, unknown>).id));
}

export async function voidTransaction(supabase: SupabaseClient, id: string, actorId: string): Promise<TransactionRecord> {
  const { data, error } = await supabase.rpc('void_transaction', { p_transaction_id: id, p_voided_by: actorId });
  if (error || !data) throw new AppError(400, 'TRANSACTION_VOID_FAILED', error?.message ?? 'The transaction could not be voided.');
  return getTransaction(supabase, String((data as Record<string, unknown>).id));
}

export async function exportTransactions(supabase: SupabaseClient): Promise<TransactionRecord[]> {
  const { data, error } = await supabase
    .from('sales_transactions')
    .select(transactionSelect)
    .order('created_at', { ascending: false });
  if (error) throw new AppError(503, 'TRANSACTIONS_LOOKUP_FAILED', 'Transactions could not be loaded.');
  return mapTransactions(supabase, data);
}