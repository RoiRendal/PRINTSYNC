import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createUser, deleteUser, updateUser } from '../../src/modules/users/users.service.js';
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

const VALID_INPUT = {
  name: 'Ana Reyes',
  email: 'ana@shop.test',
  phone: '0917 000 0000',
  role: 'staff' as const,
  position: 'Press Operator',
  password: 'secret123',
};

const PROFILE_ROW = {
  id: 'user-1',
  name: 'Ana Reyes',
  phone: '0917 000 0000',
  position: 'Press Operator',
  role_id: 'role-staff',
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
    assert.deepEqual(created.access, ['orders']);
    assert.equal(auth.callsFor('createUser').length, 1);
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
