import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdminClient } from '../integrations/supabase/adminClient.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/authorize.js';
import { getBusinessSettings, updateBusinessSettings } from '../modules/settings/settings.service.js';
import { AppError } from '../shared/errors.js';
import { sendSuccess } from '../shared/apiResponse.js';
import { writeAuditLog } from '../services/auditLogService.js';

export const settingsRouter = Router();

const settingsSchema = z.object({
  businessName: z.string().trim().min(1).max(160),
  logoUrl: z.string().trim().max(1_200_000).refine((value) => value.startsWith('data:image/') || value.startsWith('http://') || value.startsWith('https://'), 'The logo must be an image URL or data URL.').nullable().optional(),
  vatRate: z.number().min(0).max(100).optional(),
  currencySymbol: z.string().trim().min(1).max(10).optional(),
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
    metadata: { businessName: settings.businessName, hasLogo: settings.logoUrl !== null },
  });
  sendSuccess(response, settings);
});