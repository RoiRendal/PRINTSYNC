import { Router } from 'express';
import { getSupabaseAdminClient } from '../integrations/supabase/adminClient.js';
import { getPublicBranding } from '../modules/settings/settings.service.js';
import { AppError } from '../shared/errors.js';
import { sendSuccess } from '../shared/apiResponse.js';

/**
 * Unauthenticated brand identity.
 *
 * The login screen renders the company name and logo before anyone has a session,
 * so those two values cannot live behind `settings.read`. This router is the only
 * public read of `business_settings` and it is deliberately kept in its own file
 * rather than added to `settingsRouter`:
 *
 *   - the access level is different, and mixing a public route into a router whose
 *     other handlers all sit behind `authenticate` + `requirePermission` invites a
 *     future edit that accidentally protects or exposes the wrong thing;
 *   - `getPublicBranding` selects only `business_name` and `logo_url`, so VAT rate
 *     and currency symbol are never read on this path.
 *
 * No `authenticate` middleware by design. Do not add one without updating the
 * login screen, which depends on this being reachable while signed out.
 */
export const brandingRouter = Router();

brandingRouter.get('/', async (_request, response) => {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new AppError(503, 'SUPABASE_NOT_CONFIGURED', 'Supabase has not been configured for this environment.');
  }

  sendSuccess(response, await getPublicBranding(supabase));
});
