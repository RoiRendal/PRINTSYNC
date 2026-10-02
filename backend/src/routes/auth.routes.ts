import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { getSupabaseAdminClient, createSupabaseAuthClient } from '../integrations/supabase/adminClient.js';
import { authenticate } from '../middleware/authenticate.js';
import { clearAuthCookies, getCookieValue, ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, setAuthCookies } from '../shared/authCookies.js';
import { AppError } from '../shared/errors.js';
import { sendSuccess } from '../shared/apiResponse.js';
import { loadAuthContext, invalidateAuthCache } from '../services/authService.js';
import { writeAuditLog } from '../services/auditLogService.js';
import type { AuthenticatedRequestContext } from '../types/auth.js';

export const authRouter = Router();

/**
 * The signed-in user, as the three session-establishing routes return them.
 *
 * ### Why this exists
 *
 * `/login`, `/refresh` and `/session` each built this object inline, and each
 * omitted `role`, `branchId` and `canViewAllBranches`. The frontend's `AuthUser`
 * is `Omit<UserSummary, 'createdAt'>`, which *declares* those fields present, and
 * `toAuthUser` reads all three:
 *
 *   - `role` feeds `normalizeAccess(role, ...)`. With `role` absent,
 *     `isAdminTier(undefined)` is false, so every account was clamped to
 *     `STAFF_PAGE_ACCESS` — including `admin`. Analytics, Users, Settings and the
 *     Audit Log fell off the sidebar for everyone and `RequirePageAccess` bounced
 *     the route back to the Dashboard.
 *   - `canViewAllBranches` gates the head-office branch picker.
 *   - `branchId` labels the account's own branch ("… (mine)").
 *
 * The backend had all three on `auth.profile` the whole time; they were simply not
 * serialized. One helper, used by all three routes, so the payload cannot drift
 * back apart. The fields come from the same `auth` context the rest of the API
 * authorises against, so the client can never be told it may do more than the
 * server will allow: `canViewAllBranches` widens *reading* in analytics only, and
 * every write is still branch-scoped server-side.
 *
 * Exported so `tests/unit/contract.test.ts` can assert this shape against
 * `SessionUser` at compile time. That assertion is the reason this cannot silently
 * lose a field again.
 */
export function sessionUserPayload(auth: AuthenticatedRequestContext) {
  return {
    id: auth.user.id,
    email: auth.user.email,
    name: auth.profile.name,
    phone: auth.profile.phone,
    position: auth.profile.position,
    roleId: auth.profile.roleId,
    role: auth.profile.role,
    branchId: auth.profile.branchId,
    canViewAllBranches: auth.profile.canViewAllBranches,
    permissions: auth.permissions,
  };
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Please try again later.' } },
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many refresh attempts. Please try again later.' } },
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

authRouter.post('/login', loginLimiter, async (request, response) => {
  const adminClient = getSupabaseAdminClient();
  const authClient = createSupabaseAuthClient();
  if (!adminClient || !authClient) {
    throw new AppError(503, 'SUPABASE_NOT_CONFIGURED', 'Supabase has not been configured for this environment.');
  }

  const parsedBody = loginSchema.safeParse(request.body);
  if (!parsedBody.success) {
    throw new AppError(400, 'INVALID_LOGIN_REQUEST', 'A valid email and password are required.');
  }

  const { data, error } = await authClient.auth.signInWithPassword(parsedBody.data);
  if (error || !data.session || !data.user) {
    await writeAuditLog(adminClient, {
      action: 'auth.login_failed',
      entityType: 'auth',
      metadata: { email: parsedBody.data.email.toLowerCase() },
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
    });
    response.status(401).json({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      },
    });
    return;
  }

  invalidateAuthCache(data.user.id);
  const auth = await loadAuthContext(adminClient, data.user);
  await writeAuditLog(adminClient, {
    actorId: data.user.id,
    action: 'auth.login_succeeded',
    entityType: 'user',
    entityId: data.user.id,
    ipAddress: request.ip,
    userAgent: request.get('user-agent'),
  });
  setAuthCookies(response, data.session.access_token, data.session.refresh_token);
  sendSuccess(response, { user: sessionUserPayload(auth) });
});

authRouter.post('/refresh', refreshLimiter, async (request, response) => {
  const adminClient = getSupabaseAdminClient();
  const authClient = createSupabaseAuthClient();
  const refreshToken = getCookieValue(request.header('cookie'), REFRESH_TOKEN_COOKIE);
  if (!adminClient || !authClient) {
    throw new AppError(503, 'SUPABASE_NOT_CONFIGURED', 'Supabase has not been configured for this environment.');
  }
  if (!refreshToken) {
    clearAuthCookies(response);
    response.status(401).json({ error: { code: 'REFRESH_TOKEN_REQUIRED', message: 'A refresh token is required.' } });
    return;
  }

  const { data, error } = await authClient.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session || !data.user) {
    clearAuthCookies(response);
    response.status(401).json({ error: { code: 'INVALID_REFRESH_TOKEN', message: 'The refresh token is invalid or expired.' } });
    return;
  }

  invalidateAuthCache(data.user.id);
  const auth = await loadAuthContext(adminClient, data.user);
  setAuthCookies(response, data.session.access_token, data.session.refresh_token);
  sendSuccess(response, { user: sessionUserPayload(auth) });
});

authRouter.post('/logout', async (request, response) => {
  const supabase = getSupabaseAdminClient();
  const token = getCookieValue(request.header('cookie'), ACCESS_TOKEN_COOKIE);

  if (supabase && token) {
    const { data } = await supabase.auth.getUser(token);
    if (data.user) {
      invalidateAuthCache(data.user.id);
      await writeAuditLog(supabase, {
        actorId: data.user.id,
        action: 'auth.logout',
        entityType: 'user',
        entityId: data.user.id,
        ipAddress: request.ip,
        userAgent: request.get('user-agent'),
      });
      await supabase.auth.admin.signOut(token, 'global');
    }
  }

  clearAuthCookies(response);
  response.status(204).send();
});

authRouter.get('/session', authenticate, (request, response) => {
  const auth = request.auth;
  if (!auth) {
    response.status(401).json({
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication is required.',
      },
    });
    return;
  }

  sendSuccess(response, { user: sessionUserPayload(auth) });
});
