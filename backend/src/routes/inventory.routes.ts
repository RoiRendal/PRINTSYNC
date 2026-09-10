import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdminClient } from '../integrations/supabase/adminClient.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/authorize.js';
import {
  adjustInventoryStock,
  createInventoryItem,
  deleteInventoryItem,
  listInventory,
  updateInventoryItem,
} from '../modules/inventory/inventory.service.js';
import { AppError } from '../shared/errors.js';
import { sendSuccess } from '../shared/apiResponse.js';
import { writeAuditLog } from '../services/auditLogService.js';

export const inventoryRouter = Router();

const itemSchema = z.object({
  sku: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1),
  category: z.string().trim().default(''),
  stock: z.number().int().min(0).optional(),
  reorderLevel: z.number().int().min(0),
  price: z.number().min(0),
  imageUrl: z.string().trim().nullable().optional(),
});

const adjustmentSchema = z.object({
  quantity: z.number().int().refine((value) => value !== 0),
  reason: z.string().trim().min(1),
});

function getSupabase() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new AppError(503, 'SUPABASE_NOT_CONFIGURED', 'Supabase has not been configured for this environment.');
  return supabase;
}

function getItemId(request: { params: Record<string, string | string[] | undefined> }): string {
  const id = request.params.id;
  if (!id || Array.isArray(id)) throw new AppError(400, 'INVALID_INVENTORY_ID', 'The inventory item id is invalid.');
  return id;
}

inventoryRouter.get('/', authenticate, requirePermission('inventory.read'), async (_request, response) => {
  sendSuccess(response, await listInventory(getSupabase()));
});

inventoryRouter.post('/', authenticate, requirePermission('inventory.manage'), async (request, response) => {
  const parsed = itemSchema.safeParse(request.body);
  if (!parsed.success) throw new AppError(400, 'INVALID_INVENTORY_REQUEST', 'The inventory details are invalid.');
  const item = await createInventoryItem(getSupabase(), parsed.data);
  await writeAuditLog(getSupabase(), { actorId: request.auth?.user.id, action: 'inventory.created', entityType: 'inventory_item', entityId: item.id, metadata: { sku: item.sku } });
  response.status(201).json({ data: item });
});

inventoryRouter.patch('/:id', authenticate, requirePermission('inventory.manage'), async (request, response) => {
  const parsed = itemSchema.omit({ stock: true }).safeParse(request.body);
  if (!parsed.success) throw new AppError(400, 'INVALID_INVENTORY_REQUEST', 'The inventory details are invalid.');
  const itemId = getItemId(request);
  const item = await updateInventoryItem(getSupabase(), itemId, parsed.data);
  await writeAuditLog(getSupabase(), { actorId: request.auth?.user.id, action: 'inventory.updated', entityType: 'inventory_item', entityId: item.id, metadata: { sku: item.sku } });
  sendSuccess(response, item);
});

inventoryRouter.post('/:id/movements', authenticate, requirePermission('inventory.manage'), async (request, response) => {
  const parsed = adjustmentSchema.safeParse(request.body);
  if (!parsed.success || !request.auth) throw new AppError(400, 'INVALID_INVENTORY_MOVEMENT', 'The inventory movement is invalid.');
  const itemId = getItemId(request);
  const item = await adjustInventoryStock(getSupabase(), itemId, parsed.data.quantity, parsed.data.reason, request.auth.user.id);
  await writeAuditLog(getSupabase(), { actorId: request.auth.user.id, action: 'inventory.adjusted', entityType: 'inventory_item', entityId: item.id, metadata: { quantity: parsed.data.quantity, reason: parsed.data.reason } });
  sendSuccess(response, item);
});

inventoryRouter.delete('/:id', authenticate, requirePermission('inventory.manage'), async (request, response) => {
  const itemId = getItemId(request);
  await deleteInventoryItem(getSupabase(), itemId);
  await writeAuditLog(getSupabase(), { actorId: request.auth?.user.id, action: 'inventory.deleted', entityType: 'inventory_item', entityId: itemId });
  response.status(204).send();
});