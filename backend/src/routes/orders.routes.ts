import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdminClient } from '../integrations/supabase/adminClient.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/authorize.js';
import { createOrder, deleteOrder, getOrder, listOrders, updateOrder } from '../modules/orders/orders.service.js';
import { AppError } from '../shared/errors.js';
import { sendSuccess } from '../shared/apiResponse.js';
import { writeAuditLog } from '../services/auditLogService.js';
import { publishDataChange } from '../services/domainEventBus.js';
import { parsePaginationQuery } from '../shared/pagination.js';

export const ordersRouter = Router();

const statuses = ['Pending', 'In Production', 'Ready for Pickup', 'Designing', 'Completed', 'Delivered'] as const;
const lineItemSchema = z.object({
  itemId: z.string().uuid().optional(),
  name: z.string().trim().min(1),
  quantity: z.number().int().positive(),
  designId: z.string().uuid().optional(),
  unitPrice: z.number().min(0).default(0),
});
const orderSchema = z.object({
  customer: z.string().trim().min(1),
  lineItems: z.array(lineItemSchema).min(1),
  amount: z.number().min(0),
  status: z.enum(statuses).default('Pending'),
  notes: z.string().trim().default(''),
  isCustom: z.boolean().default(false),
  customerId: z.string().uuid().optional(),
  dueDate: z.string().date().optional(),
});
const updateSchema = orderSchema.partial().extend({
  /**
   * The `updatedAt` the editor loaded, echoed back so the server can refuse a save
   * that would silently overwrite someone else's. Required on purpose: a client
   * that does not send one is buggy and should fail loudly rather than quietly
   * lose its protection against lost updates.
   */
  expectedUpdatedAt: z.string().datetime({ offset: true }),
});

function getSupabase() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new AppError(503, 'SUPABASE_NOT_CONFIGURED', 'Supabase has not been configured for this environment.');
  return supabase;
}

function getOrderId(request: { params: Record<string, string | string[] | undefined> }): string {
  const id = request.params.id;
  if (!id || Array.isArray(id)) throw new AppError(400, 'INVALID_ORDER_ID', 'The order id is invalid.');
  return id;
}

ordersRouter.get('/', authenticate, requirePermission('orders.read'), async (request, response) => {
  sendSuccess(response, await listOrders(getSupabase(), parsePaginationQuery(request.query)));
});

ordersRouter.get('/:id', authenticate, requirePermission('orders.read'), async (request, response) => {
  sendSuccess(response, await getOrder(getSupabase(), getOrderId(request)));
});

ordersRouter.post('/', authenticate, requirePermission('orders.create'), async (request, response) => {
  const parsed = orderSchema.safeParse(request.body);
  if (!parsed.success || !request.auth) throw new AppError(400, 'INVALID_ORDER_REQUEST', 'The order details are invalid.');
  const order = await createOrder(getSupabase(), parsed.data, request.auth.user.id);
  await writeAuditLog(getSupabase(), { actorId: request.auth.user.id, action: 'order.created', entityType: 'order', entityId: order.id, metadata: { amount: order.amount, isCustom: order.isCustom } });
  // `create_order_with_items` reserves stock, so the inventory pages are stale too.
  publishDataChange('orders', 'inventory');
  response.status(201).json({ data: order });
});

ordersRouter.patch('/:id', authenticate, requirePermission('orders.update'), async (request, response) => {
  const parsed = updateSchema.safeParse(request.body);
  if (!parsed.success || !request.auth) throw new AppError(400, 'INVALID_ORDER_REQUEST', 'The order details are invalid.');
  const orderId = getOrderId(request);
  // The version precondition is not part of the order, so it is kept out of the
  // payload the service writes.
  const { expectedUpdatedAt, ...updates } = parsed.data;
  const order = await updateOrder(getSupabase(), orderId, updates, request.auth.user.id, expectedUpdatedAt);
  await writeAuditLog(getSupabase(), { actorId: request.auth?.user.id, action: 'order.updated', entityType: 'order', entityId: order.id, metadata: { status: order.status } });
  // Only a line-item change re-reserves stock (`replace_order_with_items`); a
  // status/notes-only update leaves inventory untouched, so we do not wake the
  // inventory pages for it.
  if (updates.lineItems !== undefined) publishDataChange('orders', 'inventory');
  else publishDataChange('orders');
  sendSuccess(response, order);
});

ordersRouter.delete('/:id', authenticate, requirePermission('orders.delete'), async (request, response) => {
  if (!request.auth) throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  const orderId = getOrderId(request);
  await deleteOrder(getSupabase(), orderId, request.auth.user.id);
  await writeAuditLog(getSupabase(), { actorId: request.auth?.user.id, action: 'order.deleted', entityType: 'order', entityId: orderId });
  // `delete_order_with_items` releases the reserved stock back to inventory.
  publishDataChange('orders', 'inventory');
  response.status(204).send();
});
