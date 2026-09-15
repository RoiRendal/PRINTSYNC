import type { SupabaseClient } from '@supabase/supabase-js';
import type { Customer } from '@printsync/shared-types';
import { AppError } from '../../shared/errors.js';

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

export async function listCustomers(supabase: SupabaseClient): Promise<Customer[]> {
  const { data, error } = await supabase.from('customers').select('*').order('name');
  if (error) throw new AppError(503, 'CUSTOMERS_LOOKUP_FAILED', 'Customers could not be loaded.');
  return data.map((row) => toCustomer(row));
}

export async function getCustomer(supabase: SupabaseClient, id: string): Promise<Customer> {
  const { data, error } = await supabase.from('customers').select('*').eq('id', id).maybeSingle();
  if (error || !data) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'The customer was not found.');
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
  if (error || !data) throw new AppError(400, 'CUSTOMER_CREATE_FAILED', 'The customer could not be created.');
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
  if (error || !data) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'The customer was not found.');
  return toCustomer(data);
}

export async function deleteCustomer(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('customers').delete().eq('id', id);
  if (error) throw new AppError(400, 'CUSTOMER_DELETE_FAILED', 'The customer could not be deleted.');
}
