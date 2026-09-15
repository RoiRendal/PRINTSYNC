import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdminClient } from '../integrations/supabase/adminClient.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/authorize.js';
import { getBusinessSettings, setBusinessLogo, updateBusinessSettings } from '../modules/settings/settings.service.js';
import { AppError } from '../shared/errors.js';
import { sendSuccess } from '../shared/apiResponse.js';
import { writeAuditLog } from '../services/auditLogService.js';
import { uploadBusinessLogo, sweepOrphanedBusinessLogosSafely } from '../services/businessAssetService.js';

export const settingsRouter = Router();

/**
 * Business name and defaults only.
 *
 * `logoUrl` was removed when the logo moved to Supabase Storage: a base64 data
 * URL is no longer accepted, and the logo now has its own endpoints so a generic
 * settings save cannot clobber it. Zod strips unknown keys, so a stale client
 * still sending `logoUrl` is ignored rather than rejected.
 */
const settingsSchema = z.object({
  businessName: z.string().trim().min(1).max(160),
  vatRate: z.number().min(0).max(100).optional(),
  currencySymbol: z.string().trim().min(1).max(10).optional(),
});

const logoUploadSchema = z.object({
  dataUrl: z.string().min(1),
  fileName: z.string().trim().min(1),
  contentType: z.string().trim().min(1),
  sizeBytes: z.number().int().positive(),
});

function getSupabase() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new AppError(503, 'SUPABASE_NOT_CONFIGURED', 'Supabase has not been configured for this environment.');
  return supabase;
}

settingsRouter.get('/', authenticate, requirePermission('settings.read'), async (_request, response) => {
  sendSuccess(response, await getBusinessSettings(getSupabase()));
});

settingsRouter.patch('/', authenticate, requirePermission('settings.manage'), async (request, response) => {
  const parsed = settingsSchema.safeParse(request.body);
  if (!parsed.success || !request.auth) throw new AppError(400, 'INVALID_SETTINGS_REQUEST', 'The business settings are invalid.');
  const settings = await updateBusinessSettings(getSupabase(), parsed.data, request.auth.user.id);
  await writeAuditLog(getSupabase(), {
    actorId: request.auth.user.id,
    action: 'settings.business_updated',
    entityType: 'business_settings',
    entityId: '1',
    metadata: { businessName: settings.businessName },
  });
  sendSuccess(response, settings);
});

/**
 * Upload a logo to the `business-assets` bucket and persist the public URL in one
 * call.
 *
 * Unlike `POST /designs/assets` — which only stores an object and hands back its
 * URL for the caller to reference later — the logo *is* the settings value, so
 * splitting this into upload-then-patch would leave an orphaned object whenever
 * the follow-up write failed.
 */
settingsRouter.post('/logo', authenticate, requirePermission('settings.manage'), async (request, response) => {
  const parsed = logoUploadSchema.safeParse(request.body);
  if (!parsed.success || !request.auth) throw new AppError(400, 'INVALID_BUSINESS_LOGO', 'The business logo is invalid.');
  const asset = await uploadBusinessLogo(getSupabase(), parsed.data, request.auth.user.id);
  const settings = await setBusinessLogo(getSupabase(), asset.imageUrl, request.auth.user.id);
  await writeAuditLog(getSupabase(), {
    actorId: request.auth.user.id,
    action: 'settings.logo_uploaded',
    entityType: 'business_settings',
    entityId: '1',
    metadata: { fileName: parsed.data.fileName, assetType: asset.assetType, assetSizeBytes: asset.assetSizeBytes },
  });
  // Housekeeping runs after the response is ready and never throws: the logo is
  // already persisted, so a Storage hiccup here must not fail the request.
  await sweepOrphanedBusinessLogosSafely(getSupabase(), settings.logoUrl);
  sendSuccess(response, settings);
});

/** Revert to the bundled `/brand-logo.png` by clearing the stored URL. */
settingsRouter.delete('/logo', authenticate, requirePermission('settings.manage'), async (request, response) => {
  if (!request.auth) throw new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  const settings = await setBusinessLogo(getSupabase(), null, request.auth.user.id);
  await writeAuditLog(getSupabase(), {
    actorId: request.auth.user.id,
    action: 'settings.logo_removed',
    entityType: 'business_settings',
    entityId: '1',
  });
  // Nothing is referenced any more, so every aged-out object becomes removable.
  await sweepOrphanedBusinessLogosSafely(getSupabase(), null);
  sendSuccess(response, settings);
});