import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdminClient } from '../integrations/supabase/adminClient.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/authorize.js';
import { getAnalyticsSummary } from '../modules/analytics/analytics.service.js';
import { AppError } from '../shared/errors.js';
import { sendSuccess } from '../shared/apiResponse.js';

export const analyticsRouter = Router();

const querySchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
});

function getSupabase() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new AppError(503, 'SUPABASE_NOT_CONFIGURED', 'Supabase has not been configured for this environment.');
  return supabase;
}

analyticsRouter.get('/summary', authenticate, requirePermission('analytics.read'), async (request, response) => {
  const parsed = querySchema.safeParse(request.query);
  if (!parsed.success) throw new AppError(400, 'INVALID_ANALYTICS_QUERY', 'Both from and to dates are required.');
  sendSuccess(response, await getAnalyticsSummary(getSupabase(), parsed.data));
});