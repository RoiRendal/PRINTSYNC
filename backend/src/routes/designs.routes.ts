import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdminClient } from '../integrations/supabase/adminClient.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/authorize.js';
import {
  createDesign,
  deleteDesign,
  listDesigns,
  updateDesign,
} from '../modules/designs/designs.service.js';
import { isAllowedStoredImageUrl } from '../shared/imageUrlPolicy.js';
import { env } from '../config/env.js';
import { AppError } from '../shared/errors.js';
import { sendSuccess } from '../shared/apiResponse.js';
import { writeAuditLog } from '../services/auditLogService.js';
import { publishDataChange } from '../services/domainEventBus.js';
import { uploadDesignAsset } from '../services/designAssetService.js';
import { parsePaginationQuery } from '../shared/pagination.js';

export const designsRouter = Router();

/**
 * The artwork link. See `shared/imageUrlPolicy.ts` for why this is not
 * `z.string().url()`: the value is rendered as an `<img src>` and passed to
 * `window.open`, so an arbitrary but syntactically valid URL is not an
 * acceptable answer here.
 */
const designImageUrl = z
  .string()
  .trim()
  .refine((value) => isAllowedStoredImageUrl(value, env.SUPABASE_URL), {
    message: 'The design image must be an uploaded asset or a bundled preview.',
  });

const designSchema = z.object({
  name: z.string().trim().min(1),
  category: z.string().trim().default(''),
  imageUrl: designImageUrl,
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

designsRouter.get('/', authenticate, requirePermission('designs.read'), async (request, response) => {
  sendSuccess(response, await listDesigns(getSupabase(), parsePaginationQuery(request.query)));
});

designsRouter.post('/', authenticate, requirePermission('designs.manage'), async (request, response) => {
  const parsed = designSchema.safeParse(request.body);
  if (!parsed.success || !request.auth) throw new AppError(400, 'INVALID_DESIGN_REQUEST', 'The design details are invalid.');
  const design = await createDesign(getSupabase(), parsed.data, request.auth.user.id);
  await writeAuditLog(getSupabase(), { actorId: request.auth.user.id, action: 'design.created', entityType: 'design', entityId: design.id, metadata: { category: design.category } });
  publishDataChange('designs');
  response.status(201).json({ data: design });
});

/**
 * PATCH accepts a design with no `imageUrl` at all.
 *
 * That is the whole point of it being a separate schema: an edit that only
 * renames a design must not have to read the stored Storage URL back out of the
 * database and post it straight back in. Making the field optional is what lets
 * the edit form stop displaying it — the client simply omits what it did not
 * change, and the column is left alone.
 */
const designUpdateSchema = designSchema.extend({
  imageUrl: designImageUrl.optional(),
});

designsRouter.patch('/:id', authenticate, requirePermission('designs.manage'), async (request, response) => {
  const parsed = designUpdateSchema.safeParse(request.body);
  if (!parsed.success) throw new AppError(400, 'INVALID_DESIGN_REQUEST', 'The design details are invalid.');
  const designId = getDesignId(request);
  const design = await updateDesign(getSupabase(), designId, parsed.data);
  await writeAuditLog(getSupabase(), { actorId: request.auth?.user.id, action: 'design.updated', entityType: 'design', entityId: design.id, metadata: { category: design.category } });
  publishDataChange('designs');
  sendSuccess(response, design);
});

designsRouter.delete('/:id', authenticate, requirePermission('designs.manage'), async (request, response) => {
  const designId = getDesignId(request);
  await deleteDesign(getSupabase(), designId);
  await writeAuditLog(getSupabase(), { actorId: request.auth?.user.id, action: 'design.deleted', entityType: 'design', entityId: designId });
  publishDataChange('designs');
  response.status(204).send();
});

const assetSchema = z.object({
  dataUrl: z.string().min(1),
  fileName: z.string().trim().min(1),
  contentType: z.string().trim().min(1),
  sizeBytes: z.number().int().positive(),
});

/**
 * Uploads a design image to Storage and returns its URL. It deliberately does
 * **not** publish a `designs` change: no design row is created here — the caller
 * passes the returned URL into `POST /designs` afterwards. Broadcasting on the
 * upload alone would wake every designs page for a record that does not exist
 * yet.
 */
designsRouter.post('/assets', authenticate, requirePermission('designs.manage'), async (request, response) => {
  const parsed = assetSchema.safeParse(request.body);
  if (!parsed.success || !request.auth) throw new AppError(400, 'INVALID_DESIGN_ASSET', 'The design image is invalid.');
  const asset = await uploadDesignAsset(getSupabase(), parsed.data, request.auth.user.id);
  await writeAuditLog(getSupabase(), { actorId: request.auth.user.id, action: 'design.asset_uploaded', entityType: 'design_asset', metadata: { fileName: parsed.data.fileName, assetType: asset.assetType, assetSizeBytes: asset.assetSizeBytes } });
  sendSuccess(response, asset, 201);
});
