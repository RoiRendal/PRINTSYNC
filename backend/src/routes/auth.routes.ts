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

export const authRouter = Router();

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
  sendSuccess(response, {
    user: {
      id: auth.user.id,
      email: auth.user.email,
      name: auth.profile.name,
      phone: auth.profile.phone,
      position: auth.profile.position,
      roleId: auth.profile.roleId,
      permissions: auth.permissions,
    },
  });
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
  sendSuccess(response, {
    user: {
      id: auth.user.id,
      email: auth.user.email,
      name: auth.profile.name,
      phone: auth.profile.phone,
      position: auth.profile.position,
      roleId: auth.profile.roleId,
      permissions: auth.permissions,
    },
  });
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

  sendSuccess(response, {
    user: {
      id: auth.user.id,
      email: auth.user.email,
      name: auth.profile.name,
      phone: auth.profile.phone,
      position: auth.profile.position,
      roleId: auth.profile.roleId,
      permissions: auth.permissions,
    },
  });
});
