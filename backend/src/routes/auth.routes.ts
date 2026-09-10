import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { sendSuccess } from '../shared/apiResponse.js';

export const authRouter = Router();

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
