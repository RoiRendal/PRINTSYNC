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

/**
 * Requires the head-office / owner capability — cross-branch **read** for analytics.
 *
 * ### Why this is not `requirePermission('analytics.view_all_branches')`
 *
 * The plan expressed the head-office exception as a permission key. The implemented
 * design (Phase 1, `20261002000200_branches.sql`) puts it on
 * `profiles.can_view_all_branches`, set from the `owner` role by the user service —
 * a column, deliberately, so the capability is queryable and auditable rather than
 * hidden inside a role-name comparison. There is **no `analytics.view_all_branches`
 * permission row**, so gating an endpoint on that key would 403 every account,
 * owner included: the check would look correct and lock everyone out.
 *
 * So the gate reads the same field the resolver does. Keeping the two in step
 * matters — if a route admitted an account the resolver then refused (or vice
 * versa) the inconsistency would surface as a 403 on a page that should load, or a
 * silently empty combined view.
 *
 * `canViewAllBranches` is a boolean on the auth context, populated from the
 * database row by `authenticate`. It is **not** a permission string, so it is not
 * something a role edit grants by accident.
 */
export const requireHeadOffice: RequestHandler = (request, _response, next) => {
  if (!request.auth) {
    next(new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.'));
    return;
  }

  if (request.auth.profile.canViewAllBranches !== true) {
    next(new AppError(403, 'BRANCH_SELECTION_FORBIDDEN', 'This account may only view analytics for its own branch.'));
    return;
  }

  next();
};
