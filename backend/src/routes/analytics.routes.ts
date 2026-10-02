import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdminClient } from '../integrations/supabase/adminClient.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission, requireHeadOffice } from '../middleware/authorize.js';
import {
  getAnalyticsSummary,
  getInventoryForecast,
  getProductTrends,
  getSalesTimeline,
  type AnalyticsBucket,
} from '../modules/analytics/analytics.service.js';
import { AppError } from '../shared/errors.js';
import {
  ALL_BRANCHES,
  resolveAnalyticsBranchFilter,
  type AnalyticsBranchFilter,
} from '../shared/analyticsBranchFilter.js';
import { sendSuccess } from '../shared/apiResponse.js';

export const analyticsRouter = Router();

/**
 * The head-office branch selector — **the one place in this backend a branch may be
 * read from the client.**
 *
 * It is safe here and nowhere else because:
 *
 *   1. It is **read-only.** No write path consults it; writes take their branch from
 *      `getCallerBranch` and give head office the same 403 a staff member gets.
 *   2. It is **gated by permission.** `resolveAnalyticsBranchFilter` refuses any
 *      account without `canViewAllBranches` with a 403, so the parameter is
 *      reachable by exactly the accounts the plan intends.
 *   3. It is **analytics-only.** Only this router reads it.
 *
 * `scripts/check-branch-source.mjs` fails the build if a branch is read from a
 * client-controlled source anywhere else in `src/routes` or `src/modules`. Because
 * this is a deliberate exception, the gate carries an explicit `ALLOWED` entry
 * naming this file and the line below, with a written reason — so widening it
 * further is a visible edit to a security gate rather than a quiet new read.
 */
const branchQuerySchema = z.object({
  branch: z.string().min(1).max(100).optional(),
});

/**
 * Resolve `?branch=` against the caller's permissions into an effective branch.
 *
 * Called by every analytics handler so the rule lives in one place. A `?branch=`
 * the caller may not have is a 403, thrown here, before any query runs.
 */
function effectiveBranch(request: {
  auth?: { profile: { canViewAllBranches: boolean; branchId: string | null } };
  query: Record<string, unknown>;
}): AnalyticsBranchFilter {
  const parsed = branchQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    throw new AppError(400, 'INVALID_ANALYTICS_QUERY', 'The branch filter is not valid.');
  }
  return resolveAnalyticsBranchFilter({
    canViewAllBranches: request.auth?.profile.canViewAllBranches === true,
    ownBranchId: request.auth?.profile.branchId ?? null,
    requestedBranchId: parsed.data.branch,
  });
}

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
  const branch = effectiveBranch(request);
  sendSuccess(response, await getAnalyticsSummary(getSupabase(), parsed.data, branch.branchId));
});

analyticsRouter.get('/sales-timeline', authenticate, requirePermission('analytics.read'), async (request, response) => {
  const parsed = bucketQuerySchema.safeParse(request.query);
  if (!parsed.success) throw new AppError(400, 'INVALID_ANALYTICS_QUERY', 'Both from and to dates are required. Bucket must be day, week, or quarter.');
  const branch = effectiveBranch(request);
  sendSuccess(response, await getSalesTimeline(getSupabase(), parsed.data, parsed.data.bucket as AnalyticsBucket, branch.branchId));
});

analyticsRouter.get('/product-trends', authenticate, requirePermission('analytics.read'), async (request, response) => {
  const parsed = bucketQuerySchema.safeParse(request.query);
  if (!parsed.success) throw new AppError(400, 'INVALID_ANALYTICS_QUERY', 'Both from and to dates are required. Bucket must be day, week, or quarter.');
  const branch = effectiveBranch(request);
  sendSuccess(response, await getProductTrends(getSupabase(), parsed.data, parsed.data.bucket as AnalyticsBucket, branch.branchId));
});

analyticsRouter.get('/inventory-forecast', authenticate, requirePermission('analytics.read'), async (request, response) => {
  const parsed = forecastQuerySchema.safeParse(request.query);
  if (!parsed.success) throw new AppError(400, 'INVALID_ANALYTICS_QUERY', 'Both from and to dates are required. horizonDays must be between 1 and 365.');
  const branch = effectiveBranch(request);
  sendSuccess(response, await getInventoryForecast(getSupabase(), parsed.data, parsed.data.horizonDays, branch.branchId));
});

/**
 * The branch comparison the owner actually asked for: Balayan vs Nasugbu over one
 * period, side by side.
 *
 * ### Why one endpoint rather than three client-side calls
 *
 * The obvious build is for the page to call `/analytics/summary` once per branch and
 * line them up. That repeats the date-range widening three times, produces three
 * `salesByDay` series that have to be aligned by the client, and — the part that
 * decides it — **lets the client decide which branches to compare.** The endpoint
 * below reads the branch list from the database instead, so the set being compared
 * is not something a request can influence beyond the period.
 *
 * It returns `salesByDay`, `revenue`, `orderCount` and `topItems` per branch plus a
 * combined total, which is the shape the comparison table and the stacked chart both
 * need. The per-branch numbers are produced by the *same* `getAnalyticsSummary` the
 * single-branch view uses, so a branch's total cannot disagree between the two
 * screens — the failure mode a second aggregation would introduce.
 */
analyticsRouter.get('/branch-comparison', authenticate, requireHeadOffice, async (request, response) => {
  const parsed = querySchema.safeParse(request.query);
  if (!parsed.success) throw new AppError(400, 'INVALID_ANALYTICS_QUERY', 'Both from and to dates are required.');
  const supabase = getSupabase();

  // The comparison is a head-office screen by definition, so `requireHeadOffice`
  // above already guarantees the caller may cross branches — there is no `?branch=`
  // to resolve here, and the caller's own branch is deliberately *not* privileged
  // over the other one.
  const { data, error } = await supabase
    .from('branches')
    .select('id, code, name')
    .eq('is_active', true)
    .order('code', { ascending: true });
  if (error) throw new AppError(503, 'BRANCHES_LOOKUP_FAILED', 'Branches could not be loaded.');

  const branches = (data ?? []) as Array<{ id: string; code: string; name: string }>;

  const perBranch = await Promise.all(
    branches.map(async (branch) => {
      const summary = await getAnalyticsSummary(supabase, parsed.data, String(branch.id));
      return {
        branchId: String(branch.id),
        code: String(branch.code),
        name: String(branch.name),
        revenue: summary.revenue,
        transactionCount: summary.transactionCount,
        orderCount: summary.orderCount,
        averageTransactionValue: summary.averageTransactionValue,
        salesByDay: summary.salesByDay,
        topItems: summary.topItems,
      };
    }),
  );

  // The combined figure is its own call — not the sum of the per-branch results —
  // so a branch added or deactivated mid-request cannot make "the total" disagree
  // with "all branches" on the single-branch view. It is the same read either way.
  const combined = await getAnalyticsSummary(supabase, parsed.data, null);

  sendSuccess(response, {
    range: parsed.data,
    branches: perBranch,
    combined: {
      revenue: combined.revenue,
      transactionCount: combined.transactionCount,
      orderCount: combined.orderCount,
      averageTransactionValue: combined.averageTransactionValue,
      salesByDay: combined.salesByDay,
      topItems: combined.topItems,
    },
  });
});

/** Re-exported so the selector's vocabulary lives in one place. */
export { ALL_BRANCHES };
