import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdminClient } from '../integrations/supabase/adminClient.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/authorize.js';
import { createTransaction, getTransaction, listTransactions, voidTransaction } from '../modules/payments/payments.service.js';
import { AppError } from '../shared/errors.js';
import { sendSuccess } from '../shared/apiResponse.js';
import { writeAuditLog } from '../services/auditLogService.js';
import { parsePaginationQuery } from '../shared/pagination.js';

export const paymentsRouter = Router();

const paymentMethods = ['Cash', 'Card', 'Custom Order'] as const;
const itemSchema = z.object({
  itemId: z.string().uuid().optional(),
  name: z.string().trim().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().min(0),
});
const transactionSchema = z.object({
  items: z.array(itemSchema).min(1),
  subtotal: z.number().min(0),
  discount: z.number().min(0).default(0),
  tax: z.number().min(0).default(0),
  total: z.number().min(0),
  paymentMethod: z.enum(paymentMethods),
  paymentAmount: z.number().positive(),
});

function getSupabase() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new AppError(503, 'SUPABASE_NOT_CONFIGURED', 'Supabase has not been configured for this environment.');
  return supabase;
}

function getTransactionId(request: { params: Record<string, string | string[] | undefined> }): string {
  const id = request.params.id;
  if (!id || Array.isArray(id)) throw new AppError(400, 'INVALID_TRANSACTION_ID', 'The transaction id is invalid.');
  return id;
}

paymentsRouter.get('/transactions', authenticate, requirePermission('payments.read'), async (request, response) => {
  sendSuccess(response, await listTransactions(getSupabase(), parsePaginationQuery(request.query)));
});

paymentsRouter.get('/transactions/:id', authenticate, requirePermission('payments.read'), async (request, response) => {
  sendSuccess(response, await getTransaction(getSupabase(), getTransactionId(request)));
});

paymentsRouter.post('/transactions', authenticate, requirePermission('payments.create'), async (request, response) => {
  const parsed = transactionSchema.safeParse(request.body);
  if (!parsed.success || !request.auth) throw new AppError(400, 'INVALID_TRANSACTION_REQUEST', 'The transaction details are invalid.');
  const transaction = await createTransaction(getSupabase(), parsed.data, request.auth.user.id);
  await writeAuditLog(getSupabase(), { actorId: request.auth.user.id, action: 'transaction.created', entityType: 'sales_transaction', entityId: transaction.id, metadata: { total: transaction.total, paymentMethod: transaction.paymentMethod } });
  response.status(201).json({ data: transaction });
});

paymentsRouter.post('/transactions/:id/void', authenticate, requirePermission('payments.void'), async (request, response) => {
  if (!request.auth) throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  const transactionId = getTransactionId(request);
  const transaction = await voidTransaction(getSupabase(), transactionId, request.auth.user.id);
  await writeAuditLog(getSupabase(), { actorId: request.auth.user.id, action: 'transaction.voided', entityType: 'sales_transaction', entityId: transaction.id });
  sendSuccess(response, transaction);
});