import { Router } from 'express';
import { getSupabaseAdminClient } from '../integrations/supabase/adminClient.js';
import { AppError } from '../shared/errors.js';
import { sendSuccess } from '../shared/apiResponse.js';

export const readyRouter = Router();

readyRouter.get('/', async (_request, response) => {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new AppError(
      503,
      'SUPABASE_NOT_CONFIGURED',
      'Supabase has not been configured for this environment.',
    );
  }

  const [{ error: authError }, roles, permissions, profiles, auditLogs] = await Promise.all([
    supabase.auth.admin.listUsers({ page: 1, perPage: 1 }),
    supabase.from('roles').select('id').limit(1),
    supabase.from('permissions').select('id').limit(1),
    supabase.from('profiles').select('id').limit(1),
    supabase.from('audit_logs').select('id').limit(1),
  ]);

  if (authError || roles.error || permissions.error || profiles.error || auditLogs.error) {
    throw new AppError(503, 'SUPABASE_UNAVAILABLE', 'Supabase is not ready.');
  }

  sendSuccess(response, {
    status: 'ready',
    provider: 'supabase',
    dependencies: {
      auth: 'ready',
      roles: 'ready',
      permissions: 'ready',
      profiles: 'ready',
      auditLogs: 'ready',
    },
    timestamp: new Date().toISOString(),
  });
});
