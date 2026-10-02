import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getCallerBranch } from '../../src/shared/branchContext.js';
import { assertAppError } from './helpers/assertAppError.js';

/*
 * The head-office exception, and the half of it that does not exist.
 *
 * The governing decision is that `canViewAllBranches` is a **read-only,
 * analytics-only** exception: an owner may look at another branch's report, and
 * may never move that branch's stock, take its orders, or edit its records. This
 * file pins the enforcement of that split at the one place every branch-owned
 * route funnels through — `getCallerBranch`.
 *
 * ### Why that function is the right place to test it
 *
 * Every write route (`POST /inventory`, `POST /orders`, the stock RPCs, expense
 * and design edits) calls `getCallerBranch(request)` and uses the result as the
 * branch it acts on. The function reads **one field** — `profile.branchId` — and
 * it does not consult `profile.canViewAllBranches` at all. That is the design:
 * "may see every branch" must not become "may write to every branch", and the
 * cheapest way to guarantee that is for the write path to be structurally
 * incapable of reading the flag.
 *
 * So the tests below hold a head-office account and assert the **write** path
 * still resolves to that account's own branch. There is no parameter, header or
 * body a caller could add to change it, because the function's only input is the
 * auth context.
 *
 * ### What is deliberately not here
 *
 * The analytics *selector* — a head-office account deliberately choosing another
 * branch to read — is Phase 4. When it lands it will be a separate, explicit
 * argument on the analytics routes, and it must **not** be implemented by
 * teaching `getCallerBranch` about the flag. The last test in this file states
 * that as an executable expectation.
 */

const OWN_BRANCH = 'branch-balayan';
const OTHER_BRANCH = 'branch-nasugbu';

/** A head-office account: sits in one branch, may read across all of them. */
const headOffice = { auth: { profile: { branchId: OWN_BRANCH, canViewAllBranches: true } } };

describe('head office: reads across branches, writes only its own', () => {
  it('resolves a write target to the account’s own branch, not the other shop', () => {
    // The core of the split. A head-office account operating from Balayan writes
    // to Balayan; "can view all branches" changed nothing about where the pen
    // lands.
    const target = getCallerBranch(headOffice);

    assert.equal(target, OWN_BRANCH);
    assert.notEqual(target, OTHER_BRANCH);
  });

  it('gives the same answer as for an ordinary staff account', () => {
    // Stated directly: the flag must not alter this function's result at all. If
    // a later edit made it return something "cleverer" for head office, this test
    // fails and the writer of that edit has to justify it here.
    const staff = { auth: { profile: { branchId: OWN_BRANCH, canViewAllBranches: false } } };

    assert.equal(getCallerBranch(headOffice), getCallerBranch(staff));
  });

  it('ignores the flag entirely — it is not part of the function’s input', () => {
    /*
     * `getCallerBranch` declares its parameter as `{ auth?: { profile: { branchId:
     * string | null } } }`. It has no access to `canViewAllBranches`, so even an
     * account that claims every privilege cannot widen the write target. The cast
     * here passes an object carrying the flag precisely to show it is not read.
     */
    const withFlag = getCallerBranch({
      auth: { profile: { branchId: OWN_BRANCH, canViewAllBranches: true } },
    } as Parameters<typeof getCallerBranch>[0]);

    assert.equal(withFlag, OWN_BRANCH);
  });

  it('still refuses a head-office account that has no branch', async () => {
    // "Can view all branches" is not a substitute for belonging to one. A
    // head-office profile with no branch cannot be silently filed into a default
    // shop — it is refused, exactly like any other unassigned account.
    await assertAppError(
      () =>
        Promise.resolve(
          getCallerBranch({ auth: { profile: { branchId: null, canViewAllBranches: true } } } as Parameters<
            typeof getCallerBranch
          >[0]),
        ),
      403,
      'BRANCH_NOT_ASSIGNED',
    );
  });

  it('would not widen the write path even if the selector were added naively', () => {
    /*
     * A guard against the tempting Phase 4 shortcut. The analytics selector must
     * arrive as an explicit, analytics-only argument. If someone instead teaches
     * `getCallerBranch` to honour a flag or a parameter, that change has to come
     * through this function — and this test exists to make the five tests above
     * fail loudly at that moment rather than after a cross-branch write ships.
     *
     * Asserted as a property of the source: the function's body reads
     * `profile.branchId` and nothing else.
     */
    const source = getCallerBranch.toString();

    assert.match(source, /profile\.branchId/, 'the write target must come from profile.branchId');
    assert.doesNotMatch(source, /canViewAllBranches/, 'the flag must never be consulted when choosing a write target');
  });
});
