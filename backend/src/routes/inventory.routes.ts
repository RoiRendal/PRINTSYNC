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
import { getCallerBranch } from '../shared/branchContext.js';
import { isAllowedStoredImageUrl } from '../shared/imageUrlPolicy.js';
import { env } from '../config/env.js';
import { writeAuditLog } from '../services/auditLogService.js';
import { publishDataChange } from '../services/domainEventBus.js';
import { uploadInventoryImage } from '../services/inventoryAssetService.js';
import { paginationQuerySchema } from '../shared/pagination.js';

export const inventoryRouter = Router();

/**
 * A stock photo link, held to the same rule as a design's artwork — see
 * `shared/imageUrlPolicy.ts`. It is `nullable` because a stock item may
 * legitimately have no photo at all, which is the one way inventory differs
 * from a design (`designs.image_url` is `not null`).
 */
const inventoryImageUrl = z
  .string()
  .trim()
  .refine((value) => isAllowedStoredImageUrl(value, env.SUPABASE_URL), {
    message: 'The stock photo must be an uploaded image or a bundled preview.',
  })
  .nullable()
  .optional();

const itemSchema = z.object({
  sku: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1),
  category: z.string().trim().default(''),
  stock: z.number().int().min(0).optional(),
  reorderLevel: z.number().int().min(0),
  price: z.number().min(0),
  costPrice: z.number().min(0).optional(),
  // Optional so a client that predates units keeps working — the column
  // defaults to 'pc'. Bounded because it is rendered inline beside a price, and
  // a 200-character unit is a layout bug rather than a unit.
  uom: z.string().trim().min(1).max(16).optional(),
  imageUrl: inventoryImageUrl,
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

/*
 * The list's query string: pagination, plus an optional low-stock flag.
 *
 * A flag that is on, or absent — never a half-applied one. The Workspace's Low
 * stock card links with `?lowStock=1`, and the list drops the parameter when the
 * user clears the filter rather than sending `false`, so an unrecognised value is
 * a 400 with a message, not a quiet fall back to the unfiltered list. Only `1`
 * and `true` turn the filter on; any other value (including an absent parameter)
 * means "show everything", which is the safe default for a flag.
 */
const listInventoryQuerySchema = paginationQuerySchema.extend({
  lowStock: z
    .string()
    .optional()
    .transform((value) => value === '1' || value === 'true'),
});

inventoryRouter.get('/', authenticate, requirePermission('inventory.read'), async (request, response) => {
  const parsed = listInventoryQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    throw new AppError(400, 'INVALID_INVENTORY_QUERY', 'The inventory filters are invalid.');
  }
  const { lowStock, ...pagination } = parsed.data;
  sendSuccess(response, await listInventory(getSupabase(), pagination, getCallerBranch(request), lowStock));
});

inventoryRouter.post('/', authenticate, requirePermission('inventory.manage'), async (request, response) => {
  const parsed = itemSchema.safeParse(request.body);
  if (!parsed.success) throw new AppError(400, 'INVALID_INVENTORY_REQUEST', 'The inventory details are invalid.');
  const item = await createInventoryItem(getSupabase(), getCallerBranch(request), parsed.data);
  await writeAuditLog(getSupabase(), { actorId: request.auth?.user.id, action: 'inventory.created', entityType: 'inventory_item', entityId: item.id, metadata: { sku: item.sku } });
  publishDataChange('inventory');
  response.status(201).json({ data: item });
});

inventoryRouter.patch('/:id', authenticate, requirePermission('inventory.manage'), async (request, response) => {
  const parsed = itemSchema.omit({ stock: true }).safeParse(request.body);
  if (!parsed.success) throw new AppError(400, 'INVALID_INVENTORY_REQUEST', 'The inventory details are invalid.');
  const itemId = getItemId(request);
  const item = await updateInventoryItem(getSupabase(), itemId, getCallerBranch(request), parsed.data);
  await writeAuditLog(getSupabase(), { actorId: request.auth?.user.id, action: 'inventory.updated', entityType: 'inventory_item', entityId: item.id, metadata: { sku: item.sku } });
  publishDataChange('inventory');
  sendSuccess(response, item);
});

inventoryRouter.post('/:id/movements', authenticate, requirePermission('inventory.manage'), async (request, response) => {
  const parsed = adjustmentSchema.safeParse(request.body);
  if (!parsed.success || !request.auth) throw new AppError(400, 'INVALID_INVENTORY_MOVEMENT', 'The inventory movement is invalid.');
  const itemId = getItemId(request);
  const item = await adjustInventoryStock(getSupabase(), itemId, getCallerBranch(request), parsed.data.quantity, parsed.data.reason, request.auth.user.id);
  await writeAuditLog(getSupabase(), { actorId: request.auth.user.id, action: 'inventory.adjusted', entityType: 'inventory_item', entityId: item.id, metadata: { quantity: parsed.data.quantity, reason: parsed.data.reason } });
  publishDataChange('inventory');
  sendSuccess(response, item);
});

inventoryRouter.delete('/:id', authenticate, requirePermission('inventory.manage'), async (request, response) => {
  const itemId = getItemId(request);
  await deleteInventoryItem(getSupabase(), itemId, getCallerBranch(request));
  await writeAuditLog(getSupabase(), { actorId: request.auth?.user.id, action: 'inventory.deleted', entityType: 'inventory_item', entityId: itemId });
  publishDataChange('inventory');
  response.status(204).send();
});

const assetSchema = z.object({
  dataUrl: z.string().min(1),
  fileName: z.string().trim().min(1),
  contentType: z.string().trim().min(1),
  sizeBytes: z.number().int().positive(),
});

/**
 * Uploads a stock photo to Storage and returns its URL. It deliberately does
 * **not** publish an `inventory` change: no item row is written here — the caller
 * passes the returned URL into `POST /inventory` or `PATCH /inventory/:id`
 * afterwards. Broadcasting on the upload alone would wake every inventory page
 * for a change no row has taken yet.
 */
inventoryRouter.post('/assets', authenticate, requirePermission('inventory.manage'), async (request, response) => {
  const parsed = assetSchema.safeParse(request.body);
  if (!parsed.success || !request.auth) throw new AppError(400, 'INVALID_INVENTORY_ASSET', 'The stock photo is invalid.');
  const asset = await uploadInventoryImage(getSupabase(), parsed.data, request.auth.user.id);
  await writeAuditLog(getSupabase(), { actorId: request.auth.user.id, action: 'inventory.asset_uploaded', entityType: 'inventory_asset', metadata: { fileName: parsed.data.fileName, assetType: asset.assetType, assetSizeBytes: asset.assetSizeBytes } });
  sendSuccess(response, { imageUrl: asset.imageUrl }, 201);
});
