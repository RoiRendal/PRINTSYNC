import type { RequestHandler } from 'express';
import { getSupabaseAdminClient } from '../integrations/supabase/adminClient.js';
import { getCookieValue, ACCESS_TOKEN_COOKIE } from '../shared/authCookies.js';
import { AppError } from '../shared/errors.js';
import { loadAuthContext } from '../services/authService.js';

export const authenticate: RequestHandler = async (request, _response, next) => {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    next(new AppError(503, 'SUPABASE_NOT_CONFIGURED', 'Supabase has not been configured for this environment.'));
    return;
  }

  const authorizationHeader = request.header('authorization');
  const bearerToken = authorizationHeader?.startsWith('Bearer ')
    ? authorizationHeader.slice('Bearer '.length).trim()
    : null;
  const token = bearerToken || getCookieValue(request.header('cookie'), ACCESS_TOKEN_COOKIE);
  if (!token) {
    next(new AppError(401, 'AUTHENTICATION_REQUIRED', 'A valid bearer token is required.'));
    return;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    next(new AppError(401, 'INVALID_AUTHENTICATION', 'The supplied bearer token is invalid or expired.'));
    return;
  }
  request.auth = await loadAuthContext(supabase, data.user);
  next();
};
