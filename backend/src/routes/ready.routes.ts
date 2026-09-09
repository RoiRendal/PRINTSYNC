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

  const { error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error) {
    throw new AppError(503, 'SUPABASE_UNAVAILABLE', 'Supabase is not ready.');
  }

  sendSuccess(response, {
    status: 'ready',
    provider: 'supabase',
    timestamp: new Date().toISOString(),
  });
});
