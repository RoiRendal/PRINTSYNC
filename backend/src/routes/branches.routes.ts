import { Router } from 'express';
import type { Branch } from '@printsync/shared-types';
import { getSupabaseAdminClient } from '../integrations/supabase/adminClient.js';
import { authenticate } from '../middleware/authenticate.js';
import { AppError } from '../shared/errors.js';
import { sendSuccess } from '../shared/apiResponse.js';

export const branchesRouter = Router();

/**
 * The list of shops.
 *
 * Any authenticated user may read it — staff need it to be told which branch they
 * are in, and the user-management form needs it to populate its branch dropdown.
 * It is not sensitive: a branch name and code are printed on every receipt.
 *
 * This is deliberately *not* scoped to the caller's branch. A branch list that
 * hides the other branch cannot populate a head-office selector, and knowing that
 * "Nasugbu exists" is not the same as reading its orders. What stays scoped is the
 * operational data (Phase 3), not the fact that the company has two shops.
 */
branchesRouter.get('/', authenticate, async (_request, response) => {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new AppError(503, 'SUPABASE_NOT_CONFIGURED', 'Supabase has not been configured for this environment.');
  }

  const { data, error } = await supabase
    .from('branches')
    .select('id, code, name, address, time_zone, is_active')
    .order('code', { ascending: true });

  if (error) throw new AppError(503, 'BRANCHES_LOOKUP_FAILED', 'Branches could not be loaded.');

  const branches: Branch[] = (data ?? []).map((row) => ({
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    address: String(row.address ?? ''),
    timeZone: String(row.time_zone),
    isActive: row.is_active === true,
  }));

  sendSuccess(response, branches);
});
