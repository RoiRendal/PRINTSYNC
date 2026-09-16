import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdminClient } from '../integrations/supabase/adminClient.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/authorize.js';
import { createCustomer, deleteCustomer, getCustomer, listCustomers, updateCustomer } from '../modules/customers/customers.service.js';
import { AppError } from '../shared/errors.js';
import { sendSuccess } from '../shared/apiResponse.js';
import { writeAuditLog } from '../services/auditLogService.js';
import { publishDataChange } from '../services/domainEventBus.js';
import { parsePaginationQuery } from '../shared/pagination.js';

export const customersRouter = Router();

const customerSchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().default(''),
  email: z.string().trim().email().or(z.literal('')).default(''),
  notes: z.string().trim().default(''),
});

function getSupabase() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new AppError(503, 'SUPABASE_NOT_CONFIGURED', 'Supabase has not been configured for this environment.');
  return supabase;
}

function getCustomerId(request: { params: Record<string, string | string[] | undefined> }): string {
  const id = request.params.id;
  if (!id || Array.isArray(id)) throw new AppError(400, 'INVALID_CUSTOMER_ID', 'The customer id is invalid.');
  return id;
}

customersRouter.get('/', authenticate, requirePermission('customers.read'), async (request, response) => {
  sendSuccess(response, await listCustomers(getSupabase(), parsePaginationQuery(request.query)));
});

customersRouter.get('/:id', authenticate, requirePermission('customers.read'), async (request, response) => {
  sendSuccess(response, await getCustomer(getSupabase(), getCustomerId(request)));
});

customersRouter.post('/', authenticate, requirePermission('customers.manage'), async (request, response) => {
  const parsed = customerSchema.safeParse(request.body);
  if (!parsed.success || !request.auth) throw new AppError(400, 'INVALID_CUSTOMER_REQUEST', 'The customer details are invalid.');
  const customer = await createCustomer(getSupabase(), parsed.data);
  await writeAuditLog(getSupabase(), { actorId: request.auth.user.id, action: 'customer.created', entityType: 'customer', entityId: customer.id, metadata: { name: customer.name } });
  publishDataChange('customers');
  response.status(201).json({ data: customer });
});

customersRouter.patch('/:id', authenticate, requirePermission('customers.manage'), async (request, response) => {
  const parsed = customerSchema.safeParse(request.body);
  if (!parsed.success || !request.auth) throw new AppError(400, 'INVALID_CUSTOMER_REQUEST', 'The customer details are invalid.');
  const customer = await updateCustomer(getSupabase(), getCustomerId(request), parsed.data);
  await writeAuditLog(getSupabase(), { actorId: request.auth.user.id, action: 'customer.updated', entityType: 'customer', entityId: customer.id, metadata: { name: customer.name } });
  publishDataChange('customers');
  sendSuccess(response, customer);
});

customersRouter.delete('/:id', authenticate, requirePermission('customers.manage'), async (request, response) => {
  if (!request.auth) throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  const customerId = getCustomerId(request);
  await deleteCustomer(getSupabase(), customerId);
  await writeAuditLog(getSupabase(), { actorId: request.auth.user.id, action: 'customer.deleted', entityType: 'customer', entityId: customerId });
  publishDataChange('customers');
  response.status(204).send();
});
