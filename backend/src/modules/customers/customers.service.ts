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
): Promise<PaginatedResponse<Customer>> {
  const { start, end } = calculateRange(params.page, params.limit);
  const { data, error, count } = await supabase
    .from('customers')
    .select('*', { count: 'exact' })
    .order('name')
    .range(start, end);
  if (error) throw new AppError(503, 'CUSTOMERS_LOOKUP_FAILED', 'Customers could not be loaded.');
  return createPaginatedResponse(data.map((row) => toCustomer(row)), count ?? 0, params.page, params.limit);
}

export async function getCustomer(supabase: SupabaseClient, id: string): Promise<Customer> {
  const { data, error } = await supabase.from('customers').select('*').eq('id', id).maybeSingle();
  if (error) throw new AppError(503, 'CUSTOMERS_LOOKUP_FAILED', 'The customer could not be loaded.');
  if (!data) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'The customer was not found.');
  return toCustomer(data);
}

export async function createCustomer(supabase: SupabaseClient, input: CustomerInput): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .insert({
      name: input.name.trim(),
      phone: input.phone?.trim() ?? '',
      email: input.email?.trim() ?? '',
      notes: input.notes?.trim() ?? '',
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

export async function updateCustomer(supabase: SupabaseClient, id: string, input: CustomerInput): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .update({
      name: input.name.trim(),
      phone: input.phone?.trim() ?? '',
      email: input.email?.trim() ?? '',
      notes: input.notes?.trim() ?? '',
    })
    .eq('id', id)
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
export async function countOrdersForCustomer(supabase: SupabaseClient, id: string): Promise<number> {
  const { count, error } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', id);
  if (error) throw new AppError(503, 'ORDER_COUNT_FAILED', "This customer's order history could not be checked.");
  return count ?? 0;
}

export async function deleteCustomer(supabase: SupabaseClient, id: string): Promise<void> {
  /*
   * `.select('id')` hands back the rows that were actually deleted, which is how
   * "there was nothing to delete" (a verdict — 404) is told apart from "the
   * database refused" (an outage — 503). The previous version reported both as a
   * 400, so a transient fault read as a rejection of the request.
   */
  const { data, error } = await supabase.from('customers').delete().eq('id', id).select('id');
  if (error) {
    throw new AppError(503, 'CUSTOMER_DELETE_FAILED', 'The customer could not be deleted because the database is unavailable. Try again in a moment.');
  }
  if (!data || data.length === 0) {
    throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'The customer no longer exists.');
  }
}
