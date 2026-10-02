import { AppError } from './errors.js';
import { logger } from './logger.js';

/**
 * The branch an analytics read is *about* — which is not always the caller's own.
 *
 * ### Why analytics is allowed to ask, when nothing else is
 *
 * Every other surface in this system takes its branch from
 * `request.auth.profile.branchId` via `getCallerBranch`, and a client-supplied
 * branch is refused (`scripts/check-branch-source.mjs` enforces that at the source
 * level). Analytics is the **one** documented exception, and the plan states its
 * limits: it is *read-only* and it is *analytics-only*. The owner needs to see
 * Balayan's numbers from head office; nobody needs to *edit* Balayan's stock from
 * Nasugbu.
 *
 * That exception is dangerous precisely because it looks small. A single function
 * that answers "which branch is this request about?" and returns whatever the
 * client asked for would hand every staff member the other shop's revenue. So the
 * widening is not allowed to happen quietly inside a handler: it happens **here**,
 * once, where it can be read, tested and argued with — and it is **withheld from
 * anyone without `canViewAllBranches`**.
 *
 * ### What this deliberately does NOT do
 *
 * It does **not** teach `getCallerBranch` about `canViewAllBranches`. That
 * function's whole value is that its answer cannot be influenced by the caller;
 * giving it a second mode would mean every existing call site silently acquired a
 * cross-branch capability. The two concerns stay in two functions: `getCallerBranch`
 * answers "where am I", and this answers "what may I look at".
 *
 * It also does **not** widen writes. Nothing in the write path calls this — the
 * write path calls `getCallerBranch`, so head office editing a branch they are not
 * sitting in gets the same 403 a staff member would. That is the plan's
 * requirement, and it is structural rather than a rule someone has to remember.
 */

/** The token a caller sends to mean "every branch" — the head-office combined view. */
export const ALL_BRANCHES = 'all';

export interface AnalyticsBranchFilter {
  /**
   * The branch to scope the query to, or `null` for the combined view. This is the
   * value that ends up in `p_branch_id` and in every service call.
   */
  branchId: string | null;
  /** True when the result spans every branch — the head-office default. */
  isCombined: boolean;
}

export interface AnalyticsBranchRequest {
  /** `request.auth.profile.canViewAllBranches`. */
  canViewAllBranches: boolean;
  /** `request.auth.profile.branchId` — the branch the caller is *sitting in*. */
  ownBranchId: string | null;
  /**
   * The raw `?branch=` value, if the client sent one. `undefined` means the caller
   * did not choose, and the default applies.
   *
   * Written as `string | undefined` rather than `?: string` because the repo runs
   * with `exactOptionalPropertyTypes`, where an optional property means "may be
   * absent" but not "may be explicitly `undefined`" — and the route passes
   * `parsed.data.branch`, whose type *is* `string | undefined`.
   */
  requestedBranchId?: string | undefined;
}

/**
 * Decide which branch an analytics read may cover, or refuse.
 *
 * The rules, in order:
 *
 * 1. **No selector sent** → the caller's own branch. This is the staff path AND the
 *    head-office default; note the default is *not* "all branches" even for head
 *    office, because a page that silently opens on a business-wide total is a page
 *    someone will screenshot as "this month's sales" when it is two shops'.
 * 2. **A specific branch sent** → honoured only with `canViewAllBranches`.
 * 3. **`all` sent** → honoured only with `canViewAllBranches`.
 * 4. **A caller with no branch and no permission** → refused. This mirrors
 *    `getCallerBranch`: a request that cannot be attributed to a branch must not be
 *    silently answered with a business-wide total, because that is a leak wearing
 *    the costume of an empty result.
 *
 * A refusal is a **403**, unlike `assertRowBelongsToBranch`'s 404. The difference is
 * deliberate: that function is guarding a *record by id*, where the 404 hides which
 * ids exist. This one is guarding a *parameter the caller names openly* — asking for
 * a branch you may not see is not a probe, it is a request, and telling the caller
 * "you may not see that branch" reveals nothing they did not already type. A 403
 * here is also the clearer support answer ("the account is not allowed across
 * branches") rather than a confusing "not found".
 */
export function resolveAnalyticsBranchFilter(request: AnalyticsBranchRequest): AnalyticsBranchFilter {
  const { canViewAllBranches, ownBranchId, requestedBranchId } = request;

  // 1. No choice made — everyone defaults to their own branch.
  if (requestedBranchId === undefined || requestedBranchId === '' || requestedBranchId === ownBranchId) {
    if (ownBranchId) return { branchId: ownBranchId, isCombined: false };
    /*
     * No branch of their own. With the permission this is a head-office account
     * that is only permitted the combined view (an account with `canViewAllBranches`
     * but no home branch is a legitimate shape — see the plan's head-office model).
     * Without it, the request cannot be attributed to anything and is refused.
     */
    if (canViewAllBranches) return { branchId: null, isCombined: true };
    throw new AppError(
      403,
      'BRANCH_NOT_ASSIGNED',
      'This account is not assigned to a branch and may not read analytics.',
    );
  }

  // 2 & 3. A choice was made — only the head-office permission may make it.
  if (!canViewAllBranches) {
    /*
     * Logged as a refusal rather than answered quietly: a staff account asking to
     * read another branch is either a misconfigured client or someone testing the
     * boundary, and both deserve to be visible. The branch the caller asked for is
     * theirs to know — they typed it — so naming it here leaks nothing.
     */
    logger.warn('Cross-branch analytics refused', {
      callerBranch: ownBranchId,
      requestedBranch: requestedBranchId === ALL_BRANCHES ? 'all' : requestedBranchId,
    });
    throw new AppError(
      403,
      'BRANCH_SELECTION_FORBIDDEN',
      'This account may only view analytics for its own branch.',
    );
  }

  if (requestedBranchId === ALL_BRANCHES) return { branchId: null, isCombined: true };
  return { branchId: requestedBranchId, isCombined: false };
}
