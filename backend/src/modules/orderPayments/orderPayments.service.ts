import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../shared/errors.js';
import { assertRowBelongsToBranch } from '../../shared/branchContext.js';

export type OrderPaymentMethod = 'Cash' | 'Card' | 'Other';

export interface OrderPayment {
  id: string;
  orderId: string;
  amount: number;
  method: OrderPaymentMethod;
  notes: string;
  /**
   * Who recorded the payment. Optional rather than `string | undefined`: the row
   * may have no `created_by`, and the key is then dropped by `JSON.stringify`
   * before it reaches the client. Declaring it required described this process's
   * object, not the wire.
   */
  createdBy?: string | undefined;
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

/*
 * `order_payments` has **no branch column** and is not meant to: a payment on an
 * order belongs to whichever branch owns that order, and the parent FK is the
 * single source of truth (migration 20261002000300 adds the column to the eight
 * owned tables and deliberately not to the child tables). So branch scoping here
 * is always "resolve the order first, then act" — never `.eq('branch_id', …)` on
 * this table, which has no such column and would fail at runtime.
 *
 * This file previously had **no branch check at all**, which was a cross-branch
 * read *and* write hole: `GET /order-payments/:orderId` returned any order's
 * payments for any authenticated caller holding `order_payments.read`, and the
 * POST attached a payment to any order id. The checks below close it by routing
 * every entry point through the parent order's ownership.
 */

async function assertOrderOwnedByBranch(
  supabase: SupabaseClient,
  orderId: string,
  branchId: string,
): Promise<void> {
  await assertRowBelongsToBranch(supabase, {
    table: 'orders',
    id: orderId,
    branchId,
    entityLabel: 'order',
    notFoundCode: 'ORDER_NOT_FOUND',
  });
}

export async function listOrderPayments(
  supabase: SupabaseClient,
  orderId: string,
  branchId: string,
): Promise<OrderPayment[]> {
  // The parent is resolved first. Without this an id from the other branch
  // returned its payments — and a filtered-empty list would have been worse,
  // because it reads as "this order has no payments" rather than "not yours".
  await assertOrderOwnedByBranch(supabase, orderId, branchId);

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
  branchId: string,
): Promise<OrderPayment> {
  // The order is the thing that carries the branch, so it is checked before the
  // insert. `order_id` arrives in the request body, so without this a caller
  // could attach a payment to an order in a shop they cannot see — a write
  // against another branch's books, which is the failure this phase exists to
  // prevent.
  await assertOrderOwnedByBranch(supabase, input.orderId, branchId);

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

export async function deleteOrderPayment(
  supabase: SupabaseClient,
  id: string,
  branchId: string,
): Promise<void> {
  /*
   * The payment row is found first so its **parent order** can be resolved — a
   * delete arrives with the payment's own id, which says nothing about the
   * branch. The `order_id` on the row is the bridge.
   */
  const { data: payment, error: lookupError } = await supabase
    .from('order_payments')
    .select('id, order_id')
    .eq('id', id)
    .maybeSingle();
  if (lookupError) throw new AppError(503, 'ORDER_PAYMENT_LOOKUP_FAILED', 'The payment could not be checked.');
  if (!payment) throw new AppError(404, 'ORDER_PAYMENT_NOT_FOUND', 'The payment was not found.');

  await assertOrderOwnedByBranch(supabase, String((payment as Record<string, unknown>).order_id), branchId);

  const { error } = await supabase.from('order_payments').delete().eq('id', id);
  if (error) throw new AppError(400, 'ORDER_PAYMENT_DELETE_FAILED', 'The payment could not be deleted.');
}
