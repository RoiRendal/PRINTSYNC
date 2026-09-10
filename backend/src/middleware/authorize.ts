import type { RequestHandler } from 'express';
import { AppError } from '../shared/errors.js';

export function requirePermission(permission: string): RequestHandler {
  return (request, _response, next) => {
    if (!request.auth) {
      next(new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.'));
      return;
    }

    if (!request.auth.permissions.includes(permission)) {
      next(new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action.'));
      return;
    }

    next();
  };
}
