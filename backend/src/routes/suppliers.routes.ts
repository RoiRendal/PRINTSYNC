import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdminClient } from '../integrations/supabase/adminClient.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/authorize.js';
import { createSupplier, deleteSupplier, getSupplier, listSuppliers, updateSupplier } from '../modules/suppliers/suppliers.service.js';
import { AppError } from '../shared/errors.js';
import { sendSuccess } from '../shared/apiResponse.js';
import { writeAuditLog } from '../services/auditLogService.js';

export const suppliersRouter = Router();

const supplierSchema = z.object({
  name: z.string().trim().min(1),
  contactPerson: z.string().trim().default(''),
  phone: z.string().trim().default(''),
  email: z.string().trim().email().or(z.literal('')).default(''),
  address: z.string().trim().default(''),
});

function getSupabase() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new AppError(503, 'SUPABASE_NOT_CONFIGURED', 'Supabase has not been configured for this environment.');
  return supabase;
}

function getSupplierId(request: { params: Record<string, string | string[] | undefined> }): string {
  const id = request.params.id;
  if (!id || Array.isArray(id)) throw new AppError(400, 'INVALID_SUPPLIER_ID', 'The supplier id is invalid.');
  return id;
}

suppliersRouter.get('/', authenticate, requirePermission('suppliers.read'), async (_request, response) => {
  sendSuccess(response, await listSuppliers(getSupabase()));
});

suppliersRouter.get('/:id', authenticate, requirePermission('suppliers.read'), async (request, response) => {
  sendSuccess(response, await getSupplier(getSupabase(), getSupplierId(request)));
});

suppliersRouter.post('/', authenticate, requirePermission('suppliers.manage'), async (request, response) => {
  const parsed = supplierSchema.safeParse(request.body);
  if (!parsed.success || !request.auth) throw new AppError(400, 'INVALID_SUPPLIER_REQUEST', 'The supplier details are invalid.');
  const supplier = await createSupplier(getSupabase(), parsed.data);
  await writeAuditLog(getSupabase(), { actorId: request.auth.user.id, action: 'supplier.created', entityType: 'supplier', entityId: supplier.id, metadata: { name: supplier.name } });
  response.status(201).json({ data: supplier });
});

suppliersRouter.patch('/:id', authenticate, requirePermission('suppliers.manage'), async (request, response) => {
  const parsed = supplierSchema.safeParse(request.body);
  if (!parsed.success || !request.auth) throw new AppError(400, 'INVALID_SUPPLIER_REQUEST', 'The supplier details are invalid.');
  const supplier = await updateSupplier(getSupabase(), getSupplierId(request), parsed.data);
  await writeAuditLog(getSupabase(), { actorId: request.auth.user.id, action: 'supplier.updated', entityType: 'supplier', entityId: supplier.id, metadata: { name: supplier.name } });
  sendSuccess(response, supplier);
});

suppliersRouter.delete('/:id', authenticate, requirePermission('suppliers.manage'), async (request, response) => {
  if (!request.auth) throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  const supplierId = getSupplierId(request);
  await deleteSupplier(getSupabase(), supplierId);
  await writeAuditLog(getSupabase(), { actorId: request.auth.user.id, action: 'supplier.deleted', entityType: 'supplier', entityId: supplierId });
  response.status(204).send();
});
