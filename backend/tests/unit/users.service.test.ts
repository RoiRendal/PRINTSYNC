import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createUser, deleteUser, listUsers, updateUser } from '../../src/modules/users/users.service.js';
import { createFakeSupabase } from './helpers/fakeSupabase.js';
import { withAuthAdmin } from './helpers/fakeAuthAdmin.js';
import { assertAppError, assertResolves } from './helpers/assertAppError.js';

/*
 * These tests exist because every auth failure used to collapse into a single
 * generic sentence. A duplicate email, a rejected password and a provider outage
 * were indistinguishable on screen, so the manager adding a staff member was told
 * nothing they could act on.
 *
 * The rule under test is the verdict-vs-outage split: a 4xx is the provider
 * judging the request (definite, and its own wording is best), while a 5xx — or an
 * error carrying no status at all — is an outage and must not read as a rejection.
 */

const STAFF_ROLE = { data: { id: 'role-staff', name: 'staff' }, error: null };

const BALAYAN_ID = '11111111-1111-4111-8111-111111111111';

const VALID_INPUT = {
  name: 'Ana Reyes',
  email: 'ana@shop.test',
  phone: '0917 000 0000',
  role: 'staff' as const,
  position: 'Press Operator',
  // Required: every account belongs to exactly one branch.
  branchId: BALAYAN_ID,
  password: 'secret123',
};

const PROFILE_ROW = {
  id: 'user-1',
  name: 'Ana Reyes',
  phone: '0917 000 0000',
  position: 'Press Operator',
  role_id: 'role-staff',
  branch_id: BALAYAN_ID,
  can_view_all_branches: false,
  created_at: '2026-09-16T02:00:00.000Z',
};

function setup() {
  const db = createFakeSupabase();
  const auth = withAuthAdmin(db);
  return { db, auth };
}

describe('createUser — provider failures are described accurately', () => {
  it('reports a duplicate email as a conflict, not a generic bad request', async () => {
    const { db, auth } = setup();
    db.queueTable('roles', STAFF_ROLE);
    auth.queueResult('createUser', {
      data: { user: null },
      error: {
        code: 'email_exists',
        status: 422,
        message: 'A user with this email address has already been registered',
      },
    });

    await assertAppError(
      () => createUser(db.client, VALID_INPUT),
      409,
      'EMAIL_ALREADY_REGISTERED',
      'already exists',
    );
  });

  it('recognises a duplicate email from the message when no code is supplied', async () => {
    const { db, auth } = setup();
    db.queueTable('roles', STAFF_ROLE);
    auth.queueResult('createUser', {
      data: { user: null },
      error: { status: 422, message: 'User already registered' },
    });

    await assertAppError(() => createUser(db.client, VALID_INPUT), 409, 'EMAIL_ALREADY_REGISTERED');
  });

  it('treats a 5xx as an outage rather than a verdict on the details', async () => {
    const { db, auth } = setup();
    db.queueTable('roles', STAFF_ROLE);
    auth.queueResult('createUser', {
      data: { user: null },
      error: { status: 500, message: 'Database error saving new user' },
    });

    await assertAppError(
      () => createUser(db.client, VALID_INPUT),
      503,
      'AUTH_SERVICE_UNAVAILABLE',
      'unavailable',
    );
  });

  it('treats an error with no status as an outage too', async () => {
    const { db, auth } = setup();
    db.queueTable('roles', STAFF_ROLE);
    // A thrown network failure carries no HTTP status at all.
    auth.queueResult('createUser', { data: { user: null }, error: { message: 'fetch failed' } });

    await assertAppError(() => createUser(db.client, VALID_INPUT), 503, 'AUTH_SERVICE_UNAVAILABLE');
  });

  it("passes the provider's own wording through for a 4xx it cannot interpret", async () => {
    const { db, auth } = setup();
    db.queueTable('roles', STAFF_ROLE);
    auth.queueResult('createUser', {
      data: { user: null },
      error: { status: 422, message: 'Password should be at least 6 characters' },
    });

    await assertAppError(
      () => createUser(db.client, VALID_INPUT),
      400,
      'USER_CREATION_FAILED',
      'Password should be at least 6 characters',
    );
  });

  it('still creates a user successfully', async () => {
    const { db, auth } = setup();
    db.queueTable('roles', STAFF_ROLE);
    auth.queueResult('createUser', {
      data: { user: { id: 'user-1', email: 'ana@shop.test' } },
      error: null,
    });
    db.queueTable('profiles', { data: PROFILE_ROW, error: null });
    db.queueTable('role_permissions', { data: [{ permission_id: 'perm-1' }], error: null });
    db.queueTable('permissions', { data: [{ key: 'orders.read' }], error: null });

    const created = await createUser(db.client, VALID_INPUT);

    assert.equal(created.id, 'user-1');
    assert.equal(created.email, 'ana@shop.test');
    assert.equal(created.role, 'staff');
    assert.equal(created.branchId, BALAYAN_ID);
    assert.equal(created.canViewAllBranches, false);
    assert.deepEqual(created.access, ['orders']);
    assert.equal(auth.callsFor('createUser').length, 1);

    // The branch has to reach the profile row, not merely be accepted. A user
    // whose branch was dropped on the way in would be branch-less in the database
    // and would see everything once Phase 3 scopes the reads.
    const payload = db.lastCall('profiles', 'insert')?.payload as Record<string, unknown>;
    assert.equal(payload.branch_id, BALAYAN_ID);
    assert.equal(payload.can_view_all_branches, false);
  });

  it('derives the cross-branch flag from the owner role, not from the request', async () => {
    const { db, auth } = setup();
    db.queueTable('roles', { data: { id: 'role-owner', name: 'owner' }, error: null });
    auth.queueResult('createUser', {
      data: { user: { id: 'user-2', email: 'grantly@shop.test' } },
      error: null,
    });
    db.queueTable('profiles', { data: { ...PROFILE_ROW, can_view_all_branches: true }, error: null });
    db.queueTable('role_permissions', { data: [], error: null });

    await createUser(db.client, { ...VALID_INPUT, role: 'owner', email: 'grantly@shop.test' });

    const payload = db.lastCall('profiles', 'insert')?.payload as Record<string, unknown>;
    // Owner is the *only* role that gets this, and it is derived server-side. If a
    // request could set it directly, any admin could quietly grant themselves
    // read-across to the other branch.
    assert.equal(payload.can_view_all_branches, true);
  });

  it('refuses to create a user without a password before calling the provider', async () => {
    const { db, auth } = setup();
    db.queueTable('roles', STAFF_ROLE);

    await assertAppError(
      () => createUser(db.client, { ...VALID_INPUT, password: undefined }),
      400,
      'PASSWORD_REQUIRED',
    );
    assert.equal(auth.callsFor('createUser').length, 0);
  });
});

describe('updateUser — provider failures are described accurately', () => {
  it('reports an email already used by another account as a conflict', async () => {
    const { db, auth } = setup();
    db.queueTable('roles', STAFF_ROLE);
    auth.queueResult('updateUserById', {
      data: null,
      error: { code: 'email_exists', status: 422, message: 'Email address already in use' },
    });

    await assertAppError(
      () => updateUser(db.client, 'user-1', VALID_INPUT),
      409,
      'EMAIL_ALREADY_REGISTERED',
    );
  });

  it('reports an outage as an outage, not a bad request', async () => {
    const { db, auth } = setup();
    db.queueTable('roles', STAFF_ROLE);
    auth.queueResult('updateUserById', { data: null, error: { status: 503, message: 'upstream down' } });

    await assertAppError(
      () => updateUser(db.client, 'user-1', VALID_INPUT),
      503,
      'AUTH_SERVICE_UNAVAILABLE',
      'could not be updated',
    );
  });
});

describe('deleteUser — a missing user and an outage are different answers', () => {
  it('reports a genuinely missing user as not found', async () => {
    const { db, auth } = setup();
    auth.queueResult('deleteUser', { data: null, error: { status: 404, message: 'User not found' } });

    await assertAppError(() => deleteUser(db.client, 'user-9'), 404, 'USER_NOT_FOUND');
  });

  it('does not call an outage "not found"', async () => {
    const { db, auth } = setup();
    // This is the case the old code got wrong: it answered 404 for everything,
    // sending staff hunting for a user sitting on the screen in front of them.
    auth.queueResult('deleteUser', { data: null, error: { status: 500, message: 'upstream down' } });

    await assertAppError(
      () => deleteUser(db.client, 'user-1'),
      503,
      'USER_DELETE_FAILED',
      'unavailable',
    );
  });

  it('deletes without error when the provider succeeds', async () => {
    const { db, auth } = setup();
    auth.queueResult('deleteUser', { data: { user: {} }, error: null });

    await assertResolves(() => deleteUser(db.client, 'user-1'));
  });
});

/*
 * `listUsers` — the directory must survive every role the API accepts.
 *
 * This exists because of a real outage. `listUsers` validated each row's role
 * against `admin`/`staff` only, a list written before the `owner` role existed
 * (`20261002000200_branches.sql`). The moment an owner account was provisioned,
 * every page of the directory containing that row threw — `GET /users` answered
 * 503, and `/users` (the staff management screen, reachable by nobody except
 * admin and owner) was dead for exactly the two roles that could open it.
 *
 * The invariant is not "owner is allowed" as a special case; it is that the set
 * of roles `listUsers` tolerates is the SAME set `userSchema.role` in
 * `users.routes.ts` accepts and the frontend's `access.ts` treats as admin-tier.
 * A role added to one and not the other is this bug again, so the test drives
 * every value of the enum rather than the one that broke.
 */
describe('listUsers — every role the API accepts is listable', () => {
  const profileFor = (role: string) => ({
    ...PROFILE_ROW,
    id: `user-${role}`,
    name: `${role} account`,
    email: `${role}@shop.test`,
    role_id: `role-${role}`,
    // Balayan is the shared branch, and the owner is the only role flagged for it.
    can_view_all_branches: role === 'owner',
    roles: { name: role },
  });

  /**
   * Every table `listUsers` reads through `toSummary`, in call order.
   *
   * `profiles` supplies the directory page, then each row resolves its own shop
   * time zone and permission set. Leaving one unqueued makes the fake throw
   * loudly — which is the point of the double, but it means the test has to name
   * all of them rather than only the table under test.
   */
  function queueDirectory(db: ReturnType<typeof setup>['db'], profiles: unknown[]) {
    db.queueTable('profiles', { data: profiles, error: null, count: profiles.length });
    db.onTable('business_settings', { data: { time_zone: 'Asia/Manila' }, error: null });
    db.onTable('role_permissions', { data: [], error: null });
    db.onTable('permissions', { data: [], error: null });
  }

  for (const role of ['admin', 'staff', 'owner'] as const) {
    it(`lists a directory containing an '${role}' account`, async () => {
      const { db, auth } = setup();
      queueDirectory(db, [profileFor(role)]);
      auth.queueResult('listUsers', {
        data: { users: [{ id: `user-${role}`, email: `${role}@shop.test` }] },
        error: null,
      });

      const page = await listUsers(db.client, { page: 1, limit: 20 });

      assert.equal(page.total, 1);
      assert.equal(page.data.length, 1);
      assert.equal(page.data[0]?.role, role);
    });
  }

  it('lists a MIXED directory — the owner row must not poison the page', async () => {
    const { db, auth } = setup();
    /*
     * The regression exactly as it shipped: three staff-side accounts plus the
     * owner. Before the fix this threw on the owner and the whole page 503'd, so
     * the two accounts an admin was actually looking for were unreachable too.
     */
    queueDirectory(db, [profileFor('admin'), profileFor('staff'), profileFor('owner')]);
    auth.queueResult('listUsers', {
      data: {
        users: [
          { id: 'user-admin', email: 'admin@shop.test' },
          { id: 'user-staff', email: 'staff@shop.test' },
          { id: 'user-owner', email: 'owner@shop.test' },
        ],
      },
      error: null,
    });

    const page = await listUsers(db.client, { page: 1, limit: 20 });

    assert.equal(page.data.length, 3);
    assert.deepEqual(
      page.data.map((u) => u.role).sort(),
      ['admin', 'owner', 'staff'],
    );
    // The head-office flag is carried through, not flattened to false.
    assert.equal(page.data.find((u) => u.role === 'owner')?.canViewAllBranches, true);
    assert.equal(page.data.find((u) => u.role === 'staff')?.canViewAllBranches, false);
  });

  it('still refuses a role the API would never create', async () => {
    const { db, auth } = setup();
    // The guard has to keep doing its job: a profile pointing at a role outside
    // the enum is a broken configuration and must not be rendered as if it were
    // an ordinary account with a blank role.
    queueDirectory(db, [profileFor('root')]);
    auth.queueResult('listUsers', { data: { users: [] }, error: null });

    await assertAppError(
      () => listUsers(db.client, { page: 1, limit: 20 }),
      503,
      'INVALID_ROLE_CONFIGURATION',
    );
  });
});
