import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from './errors.js';
import { logger } from './logger.js';

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

/**
 * Confirms a row belongs to the caller's branch, or refuses.
 *
 * ### Why this exists as a function
 *
 * Several entry points act on a row **by id alone** and cannot carry a branch in
 * their own WHERE clause — the money RPCs (`delete_order_with_items`,
 * `void_transaction`, `adjust_inventory_stock`) and the order-payment handlers.
 * Each of those needs the same three-part answer: read the row's branch, refuse
 * if it is another branch's, and refuse if it is gone. Writing that out by hand
 * at nine call sites is how one of them ends up subtly different — which is
 * precisely what happened to `orderPayments`, where the check was simply absent
 * and any branch could read and write any order's payments.
 *
 * ### Why the answer is 404 and not 403
 *
 * The plan asks for "a clear 403, never a silent empty result", and the concern
 * behind it is real: a silent empty row hides the difference between "not yours"
 * and "deleted", which makes support impossible. But answering **403** would say
 * something we must not say. A 403 on an id that exists and a 404 on one that
 * does not lets a caller **enumerate** the other branch: probe a uuid, read the
 * status code, and learn whether that record exists in the shop they cannot see.
 * Record counts, growth, and the existence of a particular customer all leak that
 * way. For a stock item or a customer, "does this exist at the other branch" is
 * itself business information.
 *
 * So the client is told **404** — indistinguishable from a deleted row, which is
 * exactly what it should be from the outside — and the **server writes a
 * `warn` naming the mismatch**. That satisfies both halves: no enumeration
 * signal leaves the building, and a genuine integration bug (the wrong id being
 * passed by a caller that has every right to be confused) is visible in the log
 * rather than being misread as "this order was deleted".
 */
export async function assertRowBelongsToBranch(
  supabase: SupabaseClient,
  options: {
    table: string;
    id: string;
    branchId: string;
    /** Logged on a mismatch, and used to build the refusal's message. */
    entityLabel: string;
    /** Code the 404 carries, e.g. `ORDER_NOT_FOUND`. */
    notFoundCode: string;
  },
): Promise<void> {
  const { table, id, branchId, entityLabel, notFoundCode } = options;

  const { data, error } = await supabase
    .from(table)
    .select('id, branch_id')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    throw new AppError(503, `${notFoundCode.replace(/_NOT_FOUND$/, '')}_LOOKUP_FAILED`, `The ${entityLabel} could not be checked.`);
  }

  /*
   * The row was found but belongs to another branch. Log it as what it is — a
   * cross-branch access attempt — while telling the client only that the row is
   * absent. The distinction between "found, other branch" and "not found" lives
   * here and nowhere else, deliberately.
   */
  if (data && String((data as Record<string, unknown>).branch_id) !== branchId) {
    logger.warn('Cross-branch access refused', {
      entity: entityLabel,
      table,
      id,
      callerBranch: branchId,
      rowBranch: String((data as Record<string, unknown>).branch_id),
    });
    throw new AppError(404, notFoundCode, `The ${entityLabel} was not found.`);
  }

  if (!data) {
    throw new AppError(404, notFoundCode, `The ${entityLabel} was not found.`);
  }
}
