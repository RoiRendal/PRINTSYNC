import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdminClient } from '../integrations/supabase/adminClient.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/authorize.js';
import { createOrderPayment, deleteOrderPayment, listOrderPayments } from '../modules/orderPayments/orderPayments.service.js';
import { AppError } from '../shared/errors.js';
import { sendSuccess } from '../shared/apiResponse.js';
import { writeAuditLog } from '../services/auditLogService.js';
import { publishDataChange } from '../services/domainEventBus.js';

export const orderPaymentsRouter = Router();

const paymentSchema = z.object({
  orderId: z.string().uuid(),
  amount: z.number().positive(),
  method: z.enum(['Cash', 'Card', 'Other']),
  notes: z.string().trim().default(''),
});

function getSupabase() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new AppError(503, 'SUPABASE_NOT_CONFIGURED', 'Supabase has not been configured for this environment.');
  return supabase;
}

orderPaymentsRouter.get('/:orderId', authenticate, requirePermission('order_payments.read'), async (request, response) => {
  const orderId = request.params.orderId;
  if (!orderId || Array.isArray(orderId)) throw new AppError(400, 'INVALID_ORDER_ID', 'The order id is invalid.');
  sendSuccess(response, await listOrderPayments(getSupabase(), orderId));
});

orderPaymentsRouter.post('/', authenticate, requirePermission('order_payments.create'), async (request, response) => {
  const parsed = paymentSchema.safeParse(request.body);
  if (!parsed.success || !request.auth) throw new AppError(400, 'INVALID_PAYMENT_REQUEST', 'The payment details are invalid.');
  const payment = await createOrderPayment(getSupabase(), parsed.data, request.auth.user.id);
  await writeAuditLog(getSupabase(), { actorId: request.auth.user.id, action: 'order_payment.created', entityType: 'order_payment', entityId: payment.id, metadata: { orderId: payment.orderId, amount: payment.amount } });
  // Recording a payment changes the order's balance due, so both domains move.
  publishDataChange('orders', 'payments');
  response.status(201).json({ data: payment });
});

orderPaymentsRouter.delete('/:id', authenticate, requirePermission('order_payments.create'), async (request, response) => {
  if (!request.auth) throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  const id = request.params.id;
  if (!id || Array.isArray(id)) throw new AppError(400, 'INVALID_PAYMENT_ID', 'The payment id is invalid.');
  await deleteOrderPayment(getSupabase(), id);
  await writeAuditLog(getSupabase(), { actorId: request.auth.user.id, action: 'order_payment.deleted', entityType: 'order_payment', entityId: id });
  // Removing a payment also moves the order's balance due.
  publishDataChange('orders', 'payments');
  response.status(204).send();
});
