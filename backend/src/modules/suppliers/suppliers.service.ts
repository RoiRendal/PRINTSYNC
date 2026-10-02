import type { SupabaseClient } from '@supabase/supabase-js';
import type { PaginationParams, PaginatedResponse } from '@printsync/shared-types';
import { AppError } from '../../shared/errors.js';
import { calculateRange, createPaginatedResponse } from '../../shared/pagination.js';

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierInput {
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
}

function toSupplier(row: Record<string, unknown>): Supplier {
  return {
    id: String(row.id),
    name: String(row.name),
    contactPerson: String(row.contact_person ?? ''),
    phone: String(row.phone ?? ''),
    email: String(row.email ?? ''),
    address: String(row.address ?? ''),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listSuppliers(
  supabase: SupabaseClient,
  params: PaginationParams,
  branchId: string,
): Promise<PaginatedResponse<Supplier>> {
  const { start, end } = calculateRange(params.page, params.limit);
  const { data, error, count } = await supabase
    .from('suppliers')
    .select('*', { count: 'exact' })
    // Suppliers belong to the branch that deals with them; the list is the
    // caller's branch and nothing else.
    .eq('branch_id', branchId)
    .order('name')
    .range(start, end);
  if (error) throw new AppError(503, 'SUPPLIERS_LOOKUP_FAILED', 'Suppliers could not be loaded.');
  return createPaginatedResponse(data.map((row) => toSupplier(row)), count ?? 0, params.page, params.limit);
}

export async function getSupplier(supabase: SupabaseClient, id: string, branchId: string): Promise<Supplier> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', id)
    .eq('branch_id', branchId)
    .maybeSingle();
  if (error || !data) throw new AppError(404, 'SUPPLIER_NOT_FOUND', 'The supplier was not found.');
  return toSupplier(data);
}

export async function createSupplier(supabase: SupabaseClient, branchId: string, input: SupplierInput): Promise<Supplier> {
  const { data, error } = await supabase
    .from('suppliers')
    .insert({
      name: input.name.trim(),
      contact_person: input.contactPerson?.trim() ?? '',
      phone: input.phone?.trim() ?? '',
      email: input.email?.trim() ?? '',
      address: input.address?.trim() ?? '',
      branch_id: branchId,
    })
    .select('*')
    .single();
  if (error || !data) throw new AppError(400, 'SUPPLIER_CREATE_FAILED', 'The supplier could not be created.');
  return toSupplier(data);
}

export async function updateSupplier(supabase: SupabaseClient, id: string, branchId: string, input: SupplierInput): Promise<Supplier> {
  const { data, error } = await supabase
    .from('suppliers')
    .update({
      name: input.name.trim(),
      contact_person: input.contactPerson?.trim() ?? '',
      phone: input.phone?.trim() ?? '',
      email: input.email?.trim() ?? '',
      address: input.address?.trim() ?? '',
    })
    .eq('id', id)
    .eq('branch_id', branchId)
    .select('*')
    .single();
  if (error || !data) throw new AppError(404, 'SUPPLIER_NOT_FOUND', 'The supplier was not found.');
  return toSupplier(data);
}

export async function deleteSupplier(supabase: SupabaseClient, id: string, branchId: string): Promise<void> {
  const { error } = await supabase.from('suppliers').delete().eq('id', id).eq('branch_id', branchId);
  if (error) throw new AppError(400, 'SUPPLIER_DELETE_FAILED', 'The supplier could not be deleted.');
}
