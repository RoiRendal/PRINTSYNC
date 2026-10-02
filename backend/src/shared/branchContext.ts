import { AppError } from './errors.js';

/**
 * The branch whose data this request is about.
 *
 * **Always the signed-in user's own branch**, read from the auth context and
 * never from the query string or the body. A caller-supplied branch id would let
 * any staff member read or write another branch's orders, stock and customers —
 * the exact thing branch separation exists to prevent. The id is trusted because
 * it was put on the request by `authenticate` from the `profiles` row, not by the
 * client.
 *
 * A profile with no branch is **rejected**, not defaulted. Silently filing a
 * Balayan order because the caller's branch was missing is how one shop's data
 * ends up in another's book — and it would be invisible, because the write
 * succeeds. A 403 is the only honest answer.
 *
 * Every handler that creates or lists branch-owned data calls this. It is not
 * applied globally because a handful of endpoints are legitimately
 * cross-branch (`GET /branches`, the owner's analytics selector), and those are
 * the ones that should have to *not* call it, visibly.
 */
export function getCallerBranch(request: { auth?: { profile: { branchId: string | null } } }): string {
  const branchId = request.auth?.profile.branchId;
  if (!branchId) throw new AppError(403, 'BRANCH_NOT_ASSIGNED', 'This account is not assigned to a branch.');
  return branchId;
}
