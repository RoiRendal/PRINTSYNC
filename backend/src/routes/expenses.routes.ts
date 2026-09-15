import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdminClient } from '../integrations/supabase/adminClient.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/authorize.js';
import { createExpense, deleteExpense, listExpenses, updateExpense } from '../modules/expenses/expenses.service.js';
import { AppError } from '../shared/errors.js';
import { sendSuccess } from '../shared/apiResponse.js';
import { writeAuditLog } from '../services/auditLogService.js';
import { parsePaginationQuery } from '../shared/pagination.js';

export const expensesRouter = Router();

const expenseSchema = z.object({
  category: z.string().trim().min(1),
  description: z.string().trim().default(''),
  amount: z.number().min(0),
  expenseDate: z.string().date().optional(),
});

function getSupabase() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new AppError(503, 'SUPABASE_NOT_CONFIGURED', 'Supabase has not been configured for this environment.');
  return supabase;
}

function getExpenseId(request: { params: Record<string, string | string[] | undefined> }): string {
  const id = request.params.id;
  if (!id || Array.isArray(id)) throw new AppError(400, 'INVALID_EXPENSE_ID', 'The expense id is invalid.');
  return id;
}

expensesRouter.get('/', authenticate, requirePermission('expenses.read'), async (request, response) => {
  sendSuccess(response, await listExpenses(getSupabase(), parsePaginationQuery(request.query)));
});

expensesRouter.post('/', authenticate, requirePermission('expenses.manage'), async (request, response) => {
  const parsed = expenseSchema.safeParse(request.body);
  if (!parsed.success || !request.auth) throw new AppError(400, 'INVALID_EXPENSE_REQUEST', 'The expense details are invalid.');
  const expense = await createExpense(getSupabase(), parsed.data, request.auth.user.id);
  await writeAuditLog(getSupabase(), { actorId: request.auth.user.id, action: 'expense.created', entityType: 'expense', entityId: expense.id, metadata: { category: expense.category, amount: expense.amount } });
  response.status(201).json({ data: expense });
});

expensesRouter.patch('/:id', authenticate, requirePermission('expenses.manage'), async (request, response) => {
  const parsed = expenseSchema.safeParse(request.body);
  if (!parsed.success || !request.auth) throw new AppError(400, 'INVALID_EXPENSE_REQUEST', 'The expense details are invalid.');
  const expense = await updateExpense(getSupabase(), getExpenseId(request), parsed.data);
  await writeAuditLog(getSupabase(), { actorId: request.auth.user.id, action: 'expense.updated', entityType: 'expense', entityId: expense.id, metadata: { category: expense.category, amount: expense.amount } });
  sendSuccess(response, expense);
});

expensesRouter.delete('/:id', authenticate, requirePermission('expenses.manage'), async (request, response) => {
  if (!request.auth) throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  const expenseId = getExpenseId(request);
  await deleteExpense(getSupabase(), expenseId);
  await writeAuditLog(getSupabase(), { actorId: request.auth.user.id, action: 'expense.deleted', entityType: 'expense', entityId: expenseId });
  response.status(204).send();
});
