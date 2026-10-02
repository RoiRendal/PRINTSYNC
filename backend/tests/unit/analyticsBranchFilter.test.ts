import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ALL_BRANCHES,
  resolveAnalyticsBranchFilter,
} from '../../src/shared/analyticsBranchFilter.js';
import { AppError } from '../../src/shared/errors.js';

const BALAYAN = '11111111-1111-1111-1111-111111111111';
const NASUGBU = '22222222-2222-2222-2222-222222222222';

/*
 * `resolveAnalyticsBranchFilter` is the single place in this backend where a
 * **client-supplied** branch is honoured. Everywhere else the branch comes from
 * `request.auth.profile.branchId`, and `scripts/check-branch-source.mjs` fails at
 * the source level if that stops being true.
 *
 * Because it is the one exception, its tests lean on the *refusals*. A passing
 * happy path proves the head-office selector works; only the negatives prove the
 * exception is a boundary rather than a convenience. Each "may not" case below is a
 * request a real client could construct by hand — a single query parameter standing
 * between a staff account and the other shop's revenue.
 */

/** Asserts that `run()` throws a 403 `AppError` with the expected code. */
function expectForbidden(run: () => unknown, code: string): void {
  let caught: unknown;
  try {
    run();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof AppError, `Expected an AppError refusal, received: ${String(caught)}`);
  assert.equal(caught.statusCode, 403, `Expected HTTP 403 for ${code}`);
  assert.equal(caught.code, code);
}

describe('resolveAnalyticsBranchFilter — staff', () => {
  it('defaults to the caller’s own branch when no selector is sent', () => {
    assert.deepEqual(
      resolveAnalyticsBranchFilter({ canViewAllBranches: false, ownBranchId: BALAYAN }),
      { branchId: BALAYAN, isCombined: false },
    );
  });

  it('treats an empty string exactly like "not sent", not like "all branches"', () => {
    // `?branch=` yields `''`. Read as "combined", a stray ampersand would be a
    // leak; it must fall back to the caller's own branch like any absent choice.
    const filter = resolveAnalyticsBranchFilter({
      canViewAllBranches: false,
      ownBranchId: BALAYAN,
      requestedBranchId: '',
    });
    assert.deepEqual(filter, { branchId: BALAYAN, isCombined: false });
    assert.notEqual(filter.branchId, '');
  });

  it('may name its own branch explicitly', () => {
    assert.deepEqual(
      resolveAnalyticsBranchFilter({ canViewAllBranches: false, ownBranchId: BALAYAN, requestedBranchId: BALAYAN }),
      { branchId: BALAYAN, isCombined: false },
    );
  });

  it('is refused the other branch’s analytics', () => {
    expectForbidden(
      () =>
        resolveAnalyticsBranchFilter({
          canViewAllBranches: false,
          ownBranchId: BALAYAN,
          requestedBranchId: NASUGBU,
        }),
      'BRANCH_SELECTION_FORBIDDEN',
    );
  });

  it('is refused the combined view — "all" is not a branch staff may ask for', () => {
    expectForbidden(
      () =>
        resolveAnalyticsBranchFilter({
          canViewAllBranches: false,
          ownBranchId: BALAYAN,
          requestedBranchId: ALL_BRANCHES,
        }),
      'BRANCH_SELECTION_FORBIDDEN',
    );
  });

  it('is refused when it has no branch at all, rather than answered business-wide', () => {
    // The dangerous alternative is to return `null` and aggregate every branch —
    // a leak that presents as a success.
    expectForbidden(
      () => resolveAnalyticsBranchFilter({ canViewAllBranches: false, ownBranchId: null }),
      'BRANCH_NOT_ASSIGNED',
    );
  });

  it('is refused a cross-branch read even when it has no branch of its own', () => {
    expectForbidden(
      () =>
        resolveAnalyticsBranchFilter({
          canViewAllBranches: false,
          ownBranchId: null,
          requestedBranchId: NASUGBU,
        }),
      'BRANCH_SELECTION_FORBIDDEN',
    );
  });
});

describe('resolveAnalyticsBranchFilter — head office', () => {
  it('defaults to its own branch, NOT the combined view', () => {
    // A dashboard that opens on a two-shop total is a number someone screenshots
    // as "this month". The combined view has to be a deliberate pick.
    assert.deepEqual(
      resolveAnalyticsBranchFilter({ canViewAllBranches: true, ownBranchId: BALAYAN }),
      { branchId: BALAYAN, isCombined: false },
    );
  });

  it('may read another branch', () => {
    assert.deepEqual(
      resolveAnalyticsBranchFilter({ canViewAllBranches: true, ownBranchId: BALAYAN, requestedBranchId: NASUGBU }),
      { branchId: NASUGBU, isCombined: false },
    );
  });

  it('may read the combined view', () => {
    assert.deepEqual(
      resolveAnalyticsBranchFilter({
        canViewAllBranches: true,
        ownBranchId: BALAYAN,
        requestedBranchId: ALL_BRANCHES,
      }),
      { branchId: null, isCombined: true },
    );
  });

  it('may read the combined view with no home branch of its own', () => {
    // The plan’s head-office shape: `branch_id` null + `can_view_all_branches`.
    assert.deepEqual(
      resolveAnalyticsBranchFilter({
        canViewAllBranches: true,
        ownBranchId: null,
        requestedBranchId: ALL_BRANCHES,
      }),
      { branchId: null, isCombined: true },
    );
  });

  it('falls back to the combined view when it has no home branch and no choice', () => {
    assert.deepEqual(
      resolveAnalyticsBranchFilter({ canViewAllBranches: true, ownBranchId: null }),
      { branchId: null, isCombined: true },
    );
  });

  it('treats an empty string as "no choice", never as a branch id of ""', () => {
    assert.deepEqual(
      resolveAnalyticsBranchFilter({ canViewAllBranches: true, ownBranchId: BALAYAN, requestedBranchId: '' }),
      { branchId: BALAYAN, isCombined: false },
    );
  });
});

/*
 * The property that matters most: the permission has to change the answer for a
 * cross-branch read (or it does nothing) and must NOT change it for the caller's
 * own branch (or it is doing something other than what it claims).
 */
describe('resolveAnalyticsBranchFilter — the permission is load-bearing', () => {
  it('gives the two account kinds different answers for the other branch', () => {
    let staff: unknown = 'refused';
    try {
      staff = resolveAnalyticsBranchFilter({
        canViewAllBranches: false,
        ownBranchId: BALAYAN,
        requestedBranchId: NASUGBU,
      });
    } catch {
      staff = 'refused';
    }
    const headOffice = resolveAnalyticsBranchFilter({
      canViewAllBranches: true,
      ownBranchId: BALAYAN,
      requestedBranchId: NASUGBU,
    });

    assert.equal(staff, 'refused');
    assert.equal(headOffice.branchId, NASUGBU);
  });

  it('gives the two account kinds the same answer for their own branch', () => {
    assert.deepEqual(
      resolveAnalyticsBranchFilter({ canViewAllBranches: false, ownBranchId: BALAYAN }),
      resolveAnalyticsBranchFilter({ canViewAllBranches: true, ownBranchId: BALAYAN }),
    );
  });
});
