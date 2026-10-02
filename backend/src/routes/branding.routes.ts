import { Router } from 'express';
import { getSupabaseAdminClient } from '../integrations/supabase/adminClient.js';
import { authenticate } from '../middleware/authenticate.js';
import { getBranchBranding, getPublicBranding } from '../modules/settings/settings.service.js';
import { AppError } from '../shared/errors.js';
import { getCallerBranch } from '../shared/branchContext.js';
import { sendSuccess } from '../shared/apiResponse.js';

/**
 * Brand identity — two questions, two routes in one file.
 *
 * ### `GET /branding` (unauthenticated)
 *
 * The login screen renders the company name and logo before anyone has a session,
 * so those two values cannot live behind `settings.read`. This is the only public
 * read of `business_settings`.
 *
 * No `authenticate` middleware by design. Do not add one without updating the
 * login screen, which depends on this being reachable while signed out.
 *
 * ### `GET /branding/current` (authenticated)
 *
 * The identity of the caller's **own branch**, which is what the app header and
 * every printed receipt must show. This exists because the app previously used the
 * public route above for both purposes, and that route cannot know which branch is
 * asking — so a receipt printed at Nasugbu was headed with Balayan's name.
 *
 * Separate rather than one route that behaves differently when a session happens to
 * be present: the public route must stay branch-blind (a branch taken from the query
 * string would let an anonymous caller enumerate branches), and the authenticated
 * one must never fall back to another shop's identity. Two routes state both facts;
 * one clever route hides them.
 */
export const brandingRouter = Router();

brandingRouter.get('/', async (_request, response) => {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new AppError(503, 'SUPABASE_NOT_CONFIGURED', 'Supabase has not been configured for this environment.');
  }

  // No branch: this route runs before anyone has a session, so it serves the
  // business-wide identity (the oldest settings row, which is Balayan's — the one
  // holding the owner's real logo). See `getPublicBranding`. This is the ONE place
  // that fallback is acceptable; do not reuse it for a signed-in caller.
  sendSuccess(response, await getPublicBranding(supabase));
});

/**
 * The signed-in caller's branch identity, including the address a receipt prints.
 *
 * The branch comes from the auth context via `getCallerBranch`, never from the
 * query string: this is the value that decides what a customer's receipt says, and
 * it must not be selectable by the client.
 */
brandingRouter.get('/current', authenticate, async (request, response) => {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new AppError(503, 'SUPABASE_NOT_CONFIGURED', 'Supabase has not been configured for this environment.');
  }

  sendSuccess(response, await getBranchBranding(supabase, getCallerBranch(request)));
});
