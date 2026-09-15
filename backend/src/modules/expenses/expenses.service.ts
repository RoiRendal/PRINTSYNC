import type { SupabaseClient } from '@supabase/supabase-js';
import type { PaginationParams, PaginatedResponse } from '@printsync/shared-types';
import { AppError } from '../../shared/errors.js';
import { calculateRange, createPaginatedResponse } from '../../shared/pagination.js';

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  expenseDate: string;
  createdBy: string | undefined;
  createdAt: string;
}

export interface ExpenseInput {
  category: string;
  description?: string | undefined;
  amount: number;
  expenseDate?: string | undefined;
}

function toExpense(row: Record<string, unknown>): Expense {
  return {
    id: String(row.id),
    category: String(row.category),
    description: String(row.description ?? ''),
    amount: Number(row.amount),
    expenseDate: String(row.expense_date),
    createdBy: row.created_by ? String(row.created_by) : undefined,
    createdAt: String(row.created_at),
  };
}

export async function listExpenses(
  supabase: SupabaseClient,
  params: PaginationParams,
): Promise<PaginatedResponse<Expense>> {
  const { start, end } = calculateRange(params.page, params.limit);
  const { data, error, count } = await supabase
    .from('operating_expenses')
    .select('*', { count: 'exact' })
    .order('expense_date', { ascending: false })
    .range(start, end);
  if (error) throw new AppError(503, 'EXPENSES_LOOKUP_FAILED', 'Expenses could not be loaded.');
  return createPaginatedResponse(data.map((row) => toExpense(row)), count ?? 0, params.page, params.limit);
}

export async function createExpense(
  supabase: SupabaseClient,
  input: ExpenseInput,
  actorId: string,
): Promise<Expense> {
  const { data, error } = await supabase
    .from('operating_expenses')
    .insert({
      category: input.category.trim(),
      description: input.description?.trim() ?? '',
      amount: input.amount,
      expense_date: input.expenseDate ?? new Date().toISOString().slice(0, 10),
      created_by: actorId,
    })
    .select('*')
    .single();
  if (error || !data) throw new AppError(400, 'EXPENSE_CREATE_FAILED', 'The expense could not be created.');
  return toExpense(data);
}

export async function updateExpense(supabase: SupabaseClient, id: string, input: ExpenseInput): Promise<Expense> {
  const { data, error } = await supabase
    .from('operating_expenses')
    .update({
      category: input.category.trim(),
      description: input.description?.trim() ?? '',
      amount: input.amount,
      expense_date: input.expenseDate,
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error || !data) throw new AppError(404, 'EXPENSE_NOT_FOUND', 'The expense was not found.');
  return toExpense(data);
}

export async function deleteExpense(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('operating_expenses').delete().eq('id', id);
  if (error) throw new AppError(400, 'EXPENSE_DELETE_FAILED', 'The expense could not be deleted.');
}
