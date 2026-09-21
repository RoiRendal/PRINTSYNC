import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { writeAuditLog } from '../../src/services/auditLogService.js';
import { runWithRequestContext } from '../../src/shared/requestContext.js';
import { createFakeSupabase } from './helpers/fakeSupabase.js';
import { assertAppError } from './helpers/assertAppError.js';

const REQUEST_CONTEXT = {
  requestId: 'req-1',
  ipAddress: '203.0.113.9',
  userAgent: 'till/1.0',
};

describe('services/auditLogService', () => {
  it('fills the request id, address and client string from the request context', async () => {
    const db = createFakeSupabase();
    db.queueRpc('write_audit_log', { data: null });

    await runWithRequestContext(REQUEST_CONTEXT, () =>
      writeAuditLog(db.client, {
        actorId: 'actor-1',
        action: 'customer.created',
        entityType: 'customer',
        entityId: 'customer-1',
      }),
    );

    const payload = db.lastCall('write_audit_log')?.payload as Record<string, unknown>;
    assert.equal(payload.p_actor_id, 'actor-1');
    assert.equal(payload.p_action, 'customer.created');
    assert.equal(payload.p_entity_type, 'customer');
    assert.equal(payload.p_entity_id, 'customer-1');
    assert.deepEqual(payload.p_metadata, {});
    assert.equal(payload.p_request_id, 'req-1');
    assert.equal(payload.p_ip_address, '203.0.113.9');
    assert.equal(payload.p_user_agent, 'till/1.0');
  });

  it('lets a caller override the context, for a row about a different request', async () => {
    const db = createFakeSupabase();
    db.queueRpc('write_audit_log', { data: null });

    await runWithRequestContext(REQUEST_CONTEXT, () =>
      writeAuditLog(db.client, {
        actorId: 'actor-1',
        action: 'customer.created',
        entityType: 'customer',
        requestId: 'req-from-elsewhere',
        ipAddress: '198.51.100.7',
      }),
    );

    const payload = db.lastCall('write_audit_log')?.payload as Record<string, unknown>;
    assert.equal(payload.p_request_id, 'req-from-elsewhere');
    assert.equal(payload.p_ip_address, '198.51.100.7');
    // Not overridden, so it still comes from the context.
    assert.equal(payload.p_user_agent, 'till/1.0');
  });

  it('sends nulls outside a request, as for provisionUser and the seeder', async () => {
    const db = createFakeSupabase();
    db.queueRpc('write_audit_log', { data: null });

    await writeAuditLog(db.client, { action: 'user.provisioned', entityType: 'profile', entityId: 'user-1' });

    const payload = db.lastCall('write_audit_log')?.payload as Record<string, unknown>;
    assert.equal(payload.p_actor_id, null);
    assert.equal(payload.p_request_id, null);
    assert.equal(payload.p_ip_address, null);
    assert.equal(payload.p_user_agent, null);
  });

  it('raises rather than losing the row silently', async () => {
    // The audit log is the only record that a hard delete happened — there is no
    // soft delete anywhere in this schema — so a failed write must not be a
    // warning that nothing reads.
    const db = createFakeSupabase();
    db.queueRpc('write_audit_log', { data: null, error: { code: '42501', message: 'permission denied' } });

    await assertAppError(
      () =>
        writeAuditLog(db.client, {
          actorId: 'actor-1',
          action: 'customer.deleted',
          entityType: 'customer',
          entityId: 'customer-1',
        }),
      500,
      'AUDIT_WRITE_FAILED',
    );
  });
});
