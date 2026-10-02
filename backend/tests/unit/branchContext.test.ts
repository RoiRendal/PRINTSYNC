import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getCallerBranch } from '../../src/shared/branchContext.js';
import { assertAppError } from './helpers/assertAppError.js';

/*
 * `getCallerBranch` is what every branch-owned route calls to answer "whose
 * data is this request about?". It is one line, and it is the line the whole
 * separation rests on: if it fell back to a default branch instead of refusing,
 * a profile with no branch — an unmigrated account, a provisioning mistake —
 * would quietly file orders, stock and customers into whichever shop happened
 * to be the default. The write would succeed, so nothing would look wrong.
 *
 * It is therefore tested for the two things that matter: it returns the
 * caller's own branch, and it refuses rather than substituting one.
 */

describe('getCallerBranch', () => {
  it('returns the branch on the authenticated profile', () => {
    assert.equal(getCallerBranch({ auth: { profile: { branchId: 'branch-balayan' } } }), 'branch-balayan');
  });

  it('refuses with a 403 when the profile has no branch, rather than defaulting', async () => {
    await assertAppError(
      () => Promise.resolve(getCallerBranch({ auth: { profile: { branchId: null } } })),
      403,
      'BRANCH_NOT_ASSIGNED',
    );
  });

  it('refuses when there is no auth profile at all', async () => {
    // The middleware guarantees `auth` on every route that reaches this, so an
    // absent profile means something is wrong upstream. Answering with a 403 is
    // correct; answering with a branch would be the bug this guards against.
    await assertAppError(() => Promise.resolve(getCallerBranch({})), 403, 'BRANCH_NOT_ASSIGNED');
  });

  it('ignores an empty-string branch id as firmly as a missing one', async () => {
    // A blank string is falsy but is not `null`. It must be refused too — an
    // `== null` check would let it through and write `''` as a foreign key.
    await assertAppError(
      () => Promise.resolve(getCallerBranch({ auth: { profile: { branchId: '' } } })),
      403,
      'BRANCH_NOT_ASSIGNED',
    );
  });
});
