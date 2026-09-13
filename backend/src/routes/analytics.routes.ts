import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdminClient } from '../integrations/supabase/adminClient.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/authorize.js';
import {
  getAnalyticsSummary,
  getInventoryForecast,
  getProductTrends,
  getSalesTimeline,
  type AnalyticsBucket,
} from '../modules/analytics/analytics.service.js';
import { AppError } from '../shared/errors.js';
import { sendSuccess } from '../shared/apiResponse.js';

export const analyticsRouter = Router();

const querySchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
});

const bucketQuerySchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
  bucket: z.enum(['day', 'week', 'quarter']).default('day'),
});

const forecastQuerySchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
  horizonDays: z.coerce.number().int().min(1).max(365).default(30),
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

analyticsRouter.get('/sales-timeline', authenticate, requirePermission('analytics.read'), async (request, response) => {
  const parsed = bucketQuerySchema.safeParse(request.query);
  if (!parsed.success) throw new AppError(400, 'INVALID_ANALYTICS_QUERY', 'Both from and to dates are required. Bucket must be day, week, or quarter.');
  sendSuccess(response, await getSalesTimeline(getSupabase(), parsed.data, parsed.data.bucket as AnalyticsBucket));
});

analyticsRouter.get('/product-trends', authenticate, requirePermission('analytics.read'), async (request, response) => {
  const parsed = bucketQuerySchema.safeParse(request.query);
  if (!parsed.success) throw new AppError(400, 'INVALID_ANALYTICS_QUERY', 'Both from and to dates are required. Bucket must be day, week, or quarter.');
  sendSuccess(response, await getProductTrends(getSupabase(), parsed.data, parsed.data.bucket as AnalyticsBucket));
});

analyticsRouter.get('/inventory-forecast', authenticate, requirePermission('analytics.read'), async (request, response) => {
  const parsed = forecastQuerySchema.safeParse(request.query);
  if (!parsed.success) throw new AppError(400, 'INVALID_ANALYTICS_QUERY', 'Both from and to dates are required. horizonDays must be between 1 and 365.');
  sendSuccess(response, await getInventoryForecast(getSupabase(), parsed.data, parsed.data.horizonDays));
});