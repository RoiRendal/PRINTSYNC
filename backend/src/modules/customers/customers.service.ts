import type { SupabaseClient } from '@supabase/supabase-js';
import type { Customer, PaginationParams, PaginatedResponse } from '@printsync/shared-types';
import { AppError } from '../../shared/errors.js';
import { calculateRange, createPaginatedResponse } from '../../shared/pagination.js';

export type { Customer };

export interface CustomerInput {
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
}

function toCustomer(row: Record<string, unknown>): Customer {
  return {
    id: String(row.id),
    name: String(row.name),
    phone: String(row.phone ?? ''),
    email: String(row.email ?? ''),
    notes: String(row.notes ?? ''),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listCustomers(
  supabase: SupabaseClient,
  params: PaginationParams,
  branchId: string,
): Promise<PaginatedResponse<Customer>> {
  const { start, end } = calculateRange(params.page, params.limit);
  const { data, error, count } = await supabase
    .from('customers')
    .select('*', { count: 'exact' })
    // Customers are not shared between branches, so the list is the caller's
    // branch and nothing else. `count: 'exact'` is what keeps the pager honest
    // for that filtered set rather than for the whole table.
    .eq('branch_id', branchId)
    .order('name')
    .range(start, end);
  if (error) throw new AppError(503, 'CUSTOMERS_LOOKUP_FAILED', 'Customers could not be loaded.');
  return createPaginatedResponse(data.map((row) => toCustomer(row)), count ?? 0, params.page, params.limit);
}

/**
 * A customer by id, **within a branch**.
 *
 * The branch is part of the lookup, not a filter applied afterwards: a customer
 * created by Balayan is not addressable from Nasugbu at all, so a guessed uuid
 * returns 404 rather than a row from the other shop. That is the difference
 * between branch separation and branch filtering.
 */
export async function getCustomer(supabase: SupabaseClient, id: string, branchId: string): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .eq('branch_id', branchId)
    .maybeSingle();
  if (error) throw new AppError(503, 'CUSTOMERS_LOOKUP_FAILED', 'The customer could not be loaded.');
  if (!data) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'The customer was not found.');
  return toCustomer(data);
}

export async function createCustomer(supabase: SupabaseClient, branchId: string, input: CustomerInput): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .insert({
      name: input.name.trim(),
      phone: input.phone?.trim() ?? '',
      email: input.email?.trim() ?? '',
      notes: input.notes?.trim() ?? '',
      // Written from the caller's profile, never from the request body. The
      // column is `not null` with no default, so omitting it is not an option —
      // and it must not be something the client can choose.
      branch_id: branchId,
    })
    .select('*')
    .single();
  /*
   * A write that reached the database and failed is an outage, not a verdict on
   * the details the manager typed. Reporting it as a 400 would send them
   * re-checking a form that was never the problem.
   */
  if (error) throw new AppError(503, 'CUSTOMER_CREATE_FAILED', 'The customer could not be saved because the database is unavailable. Try again in a moment.');
  if (!data) throw new AppError(503, 'CUSTOMER_CREATE_FAILED', 'The customer could not be saved because the database is unavailable. Try again in a moment.');
  return toCustomer(data);
}

export async function updateCustomer(
  supabase: SupabaseClient,
  id: string,
  branchId: string,
  input: CustomerInput,
): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .update({
      name: input.name.trim(),
      phone: input.phone?.trim() ?? '',
      email: input.email?.trim() ?? '',
      notes: input.notes?.trim() ?? '',
    })
    .eq('id', id)
    // The branch predicate is what stops a Nasugbu staff member editing a
    // Balayan customer by id: the update matches no row and falls through to the
    // 404 below, rather than succeeding against the other shop's record.
    .eq('branch_id', branchId)
    .select('*')
    .single();
  // Same split as create: an outage must not be dressed up as "not found",
  // which would send staff looking for a customer sitting on the screen.
  if (error) throw new AppError(503, 'CUSTOMER_UPDATE_FAILED', 'The customer could not be saved because the database is unavailable. Try again in a moment.');
  if (!data) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'The customer no longer exists.');
  return toCustomer(data);
}

/**
 * How many orders point at this customer.
 *
 * `head: true` makes this an exact count with **no rows transferred**, so it is
 * cheap enough to run while a confirmation dialog opens, and needs no migration.
 *
 * The `orders.customer_id` foreign key is `on delete set null`, so deleting a
 * customer is never blocked by their history — it silently unlinks the orders.
 * The delete flow asks for this number first so the warning can name it.
 */
export async function countOrdersForCustomer(supabase: SupabaseClient, id: string, branchId: string): Promise<number> {
  const { count, error } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', id)
    // Scoped for the same reason as the update: the count is shown in a warning
    // about *this* customer, and orders belong to the branch that took them. The
    // customer is already branch-scoped, so this can only ever match its own
    // branch's orders — but stating it keeps the index in use.
    .eq('branch_id', branchId);
  if (error) throw new AppError(503, 'ORDER_COUNT_FAILED', "This customer's order history could not be checked.");
  return count ?? 0;
}

export async function deleteCustomer(supabase: SupabaseClient, id: string, branchId: string): Promise<void> {
  /*
   * `.select('id')` hands back the rows that were actually deleted, which is how
   * "there was nothing to delete" (a verdict — 404) is told apart from "the
   * database refused" (an outage — 503). The previous version reported both as a
   * 400, so a transient fault read as a rejection of the request.
   */
  const { data, error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id)
    .eq('branch_id', branchId)
    .select('id');
  if (error) {
    throw new AppError(503, 'CUSTOMER_DELETE_FAILED', 'The customer could not be deleted because the database is unavailable. Try again in a moment.');
  }
  if (!data || data.length === 0) {
    throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'The customer no longer exists.');
  }
}
