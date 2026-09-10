import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdminClient } from '../integrations/supabase/adminClient.js';
import { authenticate } from '../middleware/authenticate.js';
import { clearAuthCookies, getCookieValue, ACCESS_TOKEN_COOKIE, setAuthCookies } from '../shared/authCookies.js';
import { AppError } from '../shared/errors.js';
import { sendSuccess } from '../shared/apiResponse.js';
import { loadAuthContext } from '../services/authService.js';
import { writeAuditLog } from '../services/auditLogService.js';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

authRouter.post('/login', async (request, response) => {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new AppError(503, 'SUPABASE_NOT_CONFIGURED', 'Supabase has not been configured for this environment.');
  }

  const parsedBody = loginSchema.safeParse(request.body);
  if (!parsedBody.success) {
    throw new AppError(400, 'INVALID_LOGIN_REQUEST', 'A valid email and password are required.');
  }

  const { data, error } = await supabase.auth.signInWithPassword(parsedBody.data);
  if (error || !data.session || !data.user) {
    await writeAuditLog(supabase, {
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

  const auth = await loadAuthContext(supabase, data.user);
  await writeAuditLog(supabase, {
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

authRouter.post('/logout', async (request, response) => {
  const supabase = getSupabaseAdminClient();
  const token = getCookieValue(request.header('cookie'), ACCESS_TOKEN_COOKIE);

  if (supabase && token) {
    const { data } = await supabase.auth.getUser(token);
    if (data.user) {
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
