import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdminClient } from '../integrations/supabase/adminClient.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/authorize.js';
import { createTransaction, findTransactionByIdempotencyKey, getTransaction, listTransactions, voidTransaction } from '../modules/payments/payments.service.js';
import { AppError } from '../shared/errors.js';
import { sendSuccess } from '../shared/apiResponse.js';
import { publishDataChange } from '../services/domainEventBus.js';
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
  // Money safety: the client generates this once per checkout attempt and reuses
  // it for every retry of that attempt. The RPC replays the existing transaction
  // instead of inserting a second one, so a double-click or a retry after a
  // dropped response can never charge twice. Required on purpose — a client that
  // does not send one is buggy and should fail loudly rather than silently lose
  // its protection.
  idempotencyKey: z.string().uuid(),
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

const idempotencyKeySchema = z.string().uuid();

/**
 * Checkout reconciliation: "did the sale I just attempted actually commit?"
 *
 * Registered before `/transactions/:id` so the literal `by-key` segment can
 * never be mistaken for a transaction id.
 *
 * Answers `200` with `data: null` when nothing carries the key, rather than a
 * `404`. "No sale was written" is the *expected* outcome for most calls here —
 * a checkout failed and nothing landed — so making the client parse an error
 * envelope to learn the ordinary answer would be the wrong shape. A `404` is
 * reserved for a lookup that could not be performed at all.
 */
paymentsRouter.get('/transactions/by-key/:key', authenticate, requirePermission('payments.read'), async (request, response) => {
  const rawKey = request.params.key;
  const parsedKey = idempotencyKeySchema.safeParse(Array.isArray(rawKey) ? rawKey[0] : rawKey);
  if (!parsedKey.success) throw new AppError(400, 'INVALID_IDEMPOTENCY_KEY', 'The checkout reference is invalid.');
  sendSuccess(response, await findTransactionByIdempotencyKey(getSupabase(), parsedKey.data));
});

paymentsRouter.get('/transactions/:id', authenticate, requirePermission('payments.read'), async (request, response) => {
  sendSuccess(response, await getTransaction(getSupabase(), getTransactionId(request)));
});

paymentsRouter.post('/transactions', authenticate, requirePermission('payments.create'), async (request, response) => {
  const parsed = transactionSchema.safeParse(request.body);
  if (!parsed.success || !request.auth) throw new AppError(400, 'INVALID_TRANSACTION_REQUEST', 'The transaction details are invalid.');
  // `transaction.created` is audited by `create_transaction_with_payment`, inside
  // the same transaction as the sale, its stock deduction and its payment row. A
  // replayed idempotency key writes no second row, because no second sale exists.
  const transaction = await createTransaction(getSupabase(), parsed.data, request.auth.user.id);
  // A retail sale writes a payment *and* decrements stock in one RPC.
  publishDataChange('payments', 'inventory');
  response.status(201).json({ data: transaction });
});

paymentsRouter.post('/transactions/:id/void', authenticate, requirePermission('payments.void'), async (request, response) => {
  if (!request.auth) throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  const transactionId = getTransactionId(request);
  // `transaction.voided` is audited by `void_transaction`, in the same transaction
  // as the reversal of the sale, its stock and its payment.
  const transaction = await voidTransaction(getSupabase(), transactionId, request.auth.user.id);
  // Voiding restores the deducted stock and voids the payment.
  publishDataChange('payments', 'inventory');
  sendSuccess(response, transaction);
});
