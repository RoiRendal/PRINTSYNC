import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../shared/errors.js';

export type OrderPaymentMethod = 'Cash' | 'Card' | 'Other';

export interface OrderPayment {
  id: string;
  orderId: string;
  amount: number;
  method: OrderPaymentMethod;
  notes: string;
  createdBy: string | undefined;
  createdAt: string;
}

export interface OrderPaymentInput {
  orderId: string;
  amount: number;
  method: OrderPaymentMethod;
  notes?: string | undefined;
}

function toPayment(row: Record<string, unknown>): OrderPayment {
  return {
    id: String(row.id),
    orderId: String(row.order_id),
    amount: Number(row.amount),
    method: String(row.method) as OrderPaymentMethod,
    notes: String(row.notes ?? ''),
    createdBy: row.created_by ? String(row.created_by) : undefined,
    createdAt: String(row.created_at),
  };
}

export async function listOrderPayments(supabase: SupabaseClient, orderId: string): Promise<OrderPayment[]> {
  const { data, error } = await supabase
    .from('order_payments')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });
  if (error) throw new AppError(503, 'ORDER_PAYMENTS_LOOKUP_FAILED', 'Order payments could not be loaded.');
  return data.map((row) => toPayment(row));
}

export async function createOrderPayment(
  supabase: SupabaseClient,
  input: OrderPaymentInput,
  actorId: string,
): Promise<OrderPayment> {
  const { data, error } = await supabase
    .from('order_payments')
    .insert({
      order_id: input.orderId,
      amount: input.amount,
      method: input.method,
      notes: input.notes?.trim() ?? '',
      created_by: actorId,
    })
    .select('*')
    .single();
  if (error || !data) throw new AppError(400, 'ORDER_PAYMENT_CREATE_FAILED', 'The payment could not be recorded.');
  return toPayment(data);
}

export async function deleteOrderPayment(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('order_payments').delete().eq('id', id);
  if (error) throw new AppError(400, 'ORDER_PAYMENT_DELETE_FAILED', 'The payment could not be deleted.');
}
