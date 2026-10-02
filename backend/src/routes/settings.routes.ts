import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdminClient } from '../integrations/supabase/adminClient.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/authorize.js';
import { getBusinessSettings, setBusinessLogo, updateBusinessSettings } from '../modules/settings/settings.service.js';
import { AppError } from '../shared/errors.js';
import { getCallerBranch } from '../shared/branchContext.js';
import { sendSuccess } from '../shared/apiResponse.js';
import { writeAuditLog } from '../services/auditLogService.js';
import { publishDataChange } from '../services/domainEventBus.js';
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

/**
 * The branch whose settings this request is about.
 *
 * Always the signed-in user's own branch — read from the auth context, never from
 * the query string or body. Phase 1 has one settings row per branch, so a
 * caller-supplied branch id would let any staff member read or rewrite another
 * branch's name, VAT rate and logo.
 *
 * Moved to `shared/branchContext.ts` when Phase 2 gave the same requirement to
 * every operational route; it is imported at the top of this file. The shared
 * module's doc comment carries the full reasoning, including why an account with
 * no branch is a 403 rather than a default.
 */

settingsRouter.get('/', authenticate, requirePermission('settings.read'), async (request, response) => {
  sendSuccess(response, await getBusinessSettings(getSupabase(), getCallerBranch(request)));
});

settingsRouter.patch('/', authenticate, requirePermission('settings.manage'), async (request, response) => {
  const parsed = settingsSchema.safeParse(request.body);
  if (!parsed.success || !request.auth) throw new AppError(400, 'INVALID_SETTINGS_REQUEST', 'The business settings are invalid.');
  const branchId = getCallerBranch(request);
  const settings = await updateBusinessSettings(getSupabase(), branchId, parsed.data, request.auth.user.id);
  await writeAuditLog(getSupabase(), {
    actorId: request.auth.user.id,
    action: 'settings.business_updated',
    entityType: 'business_settings',
    // The audit row names the branch, not the surrogate id. `entityId` used to be
    // the literal '1' because there was one row; with one row per branch that
    // value is no longer meaningful, and the branch is what a person reading the
    // log is actually looking for.
    entityId: branchId,
    metadata: { businessName: settings.businessName, branchId },
  });
  // The business name and currency symbol appear in page headers and every
  // receipt, so the whole app needs to pick the new values up.
  publishDataChange(getCallerBranch(request), 'settings');
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
 *
 * This is the only logo route. A `DELETE /logo` used to clear the stored URL so
 * the app fell back to a bundled `/brand-logo.png`; that file is gone, so the
 * route would have meant "delete the logo" while still being labelled as a
 * reset. Both the route and the button that called it were removed — the
 * database is the single source, and a shop with no logo shows its initials.
 */
settingsRouter.post('/logo', authenticate, requirePermission('settings.manage'), async (request, response) => {
  const parsed = logoUploadSchema.safeParse(request.body);
  if (!parsed.success || !request.auth) throw new AppError(400, 'INVALID_BUSINESS_LOGO', 'The business logo is invalid.');
  const branchId = getCallerBranch(request);
  const asset = await uploadBusinessLogo(getSupabase(), parsed.data, request.auth.user.id);
  const settings = await setBusinessLogo(getSupabase(), branchId, asset.imageUrl, request.auth.user.id);
  await writeAuditLog(getSupabase(), {
    actorId: request.auth.user.id,
    action: 'settings.logo_uploaded',
    entityType: 'business_settings',
    entityId: branchId,
    metadata: { fileName: parsed.data.fileName, assetType: asset.assetType, assetSizeBytes: asset.assetSizeBytes, branchId },
  });
  publishDataChange(getCallerBranch(request), 'settings');
  // Housekeeping runs after the response is ready and never throws: the logo is
  // already persisted, so a Storage hiccup here must not fail the request.
  await sweepOrphanedBusinessLogosSafely(getSupabase(), settings.logoUrl);
  sendSuccess(response, settings);
});
