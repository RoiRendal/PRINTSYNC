import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdminClient } from '../integrations/supabase/adminClient.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/authorize.js';
import { listAuditLogs } from '../modules/audit/audit.service.js';
import { AppError } from '../shared/errors.js';
import { sendSuccess } from '../shared/apiResponse.js';

export const auditRouter = Router();

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  action: z.string().trim().min(1).optional(),
  entityType: z.string().trim().min(1).optional(),
});

function getSupabase() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new AppError(503, 'SUPABASE_NOT_CONFIGURED', 'Supabase has not been configured for this environment.');
  }
  return supabase;
}

auditRouter.use(authenticate, requirePermission('audit.read'));

auditRouter.get('/', async (request, response) => {
  const parsed = querySchema.safeParse(request.query);
  if (!parsed.success) throw new AppError(400, 'INVALID_AUDIT_LOG_QUERY', 'The audit log filters are invalid.');
  sendSuccess(response, await listAuditLogs(getSupabase(), parsed.data));
});