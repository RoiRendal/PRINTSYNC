import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdminClient } from '../integrations/supabase/adminClient.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/authorize.js';
import { createDesign, deleteDesign, listDesigns, updateDesign } from '../modules/designs/designs.service.js';
import { AppError } from '../shared/errors.js';
import { sendSuccess } from '../shared/apiResponse.js';
import { writeAuditLog } from '../services/auditLogService.js';
import { uploadDesignAsset } from '../services/designAssetService.js';

export const designsRouter = Router();

const designSchema = z.object({
  name: z.string().trim().min(1),
  category: z.string().trim().default(''),
  imageUrl: z.string().trim().url().or(z.string().trim().startsWith('/')).refine((value) => value.length > 0),
  tags: z.array(z.string().trim().min(1)).default([]),
  assetType: z.string().trim().nullable().optional(),
  assetSizeBytes: z.number().int().min(0).nullable().optional(),
});

function getSupabase() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new AppError(503, 'SUPABASE_NOT_CONFIGURED', 'Supabase has not been configured for this environment.');
  return supabase;
}

function getDesignId(request: { params: Record<string, string | string[] | undefined> }): string {
  const id = request.params.id;
  if (!id || Array.isArray(id)) throw new AppError(400, 'INVALID_DESIGN_ID', 'The design id is invalid.');
  return id;
}

designsRouter.get('/', authenticate, requirePermission('designs.read'), async (_request, response) => {
  sendSuccess(response, await listDesigns(getSupabase()));
});

designsRouter.post('/', authenticate, requirePermission('designs.manage'), async (request, response) => {
  const parsed = designSchema.safeParse(request.body);
  if (!parsed.success || !request.auth) throw new AppError(400, 'INVALID_DESIGN_REQUEST', 'The design details are invalid.');
  const design = await createDesign(getSupabase(), parsed.data, request.auth.user.id);
  await writeAuditLog(getSupabase(), { actorId: request.auth.user.id, action: 'design.created', entityType: 'design', entityId: design.id, metadata: { category: design.category } });
  response.status(201).json({ data: design });
});

designsRouter.patch('/:id', authenticate, requirePermission('designs.manage'), async (request, response) => {
  const parsed = designSchema.safeParse(request.body);
  if (!parsed.success) throw new AppError(400, 'INVALID_DESIGN_REQUEST', 'The design details are invalid.');
  const designId = getDesignId(request);
  const design = await updateDesign(getSupabase(), designId, parsed.data);
  await writeAuditLog(getSupabase(), { actorId: request.auth?.user.id, action: 'design.updated', entityType: 'design', entityId: design.id, metadata: { category: design.category } });
  sendSuccess(response, design);
});

designsRouter.delete('/:id', authenticate, requirePermission('designs.manage'), async (request, response) => {
  const designId = getDesignId(request);
  await deleteDesign(getSupabase(), designId);
  await writeAuditLog(getSupabase(), { actorId: request.auth?.user.id, action: 'design.deleted', entityType: 'design', entityId: designId });
  response.status(204).send();
});

const assetSchema = z.object({
  dataUrl: z.string().min(1),
  fileName: z.string().trim().min(1),
  contentType: z.string().trim().min(1),
  sizeBytes: z.number().int().positive(),
});

designsRouter.post('/assets', authenticate, requirePermission('designs.manage'), async (request, response) => {
  const parsed = assetSchema.safeParse(request.body);
  if (!parsed.success || !request.auth) throw new AppError(400, 'INVALID_DESIGN_ASSET', 'The design image is invalid.');
  const asset = await uploadDesignAsset(getSupabase(), parsed.data, request.auth.user.id);
  await writeAuditLog(getSupabase(), { actorId: request.auth.user.id, action: 'design.asset_uploaded', entityType: 'design_asset', metadata: { fileName: parsed.data.fileName, assetType: asset.assetType, assetSizeBytes: asset.assetSizeBytes } });
  sendSuccess(response, asset, 201);
});