import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DATA_DOMAINS,
  DOMAIN_READ_PERMISSION,
  visibleDomainsFor,
} from '../../src/services/dataChangePermissions.js';

/**
 * The capabilities a `staff` account actually holds, accumulated from the
 * `role_permissions` inserts across `supabase/migrations`:
 *
 *   - `20260910000100_identity_authorization.sql` — orders + inventory + designs
 *   - `20260910000200_audit_logging.sql`           — `pos.read`
 *   - `20260910001100_payments_transactions.sql`   — `payments.read`/`.create`
 *   - `20260910001200_settings.sql`                — `settings.read`
 *   - `20260910002300_permissions.sql`             — customers + order_payments
 *
 * Written out rather than imported because the grants live in SQL. If a
 * migration changes them, this list is the thing to update — and the assertions
 * below will fail loudly rather than letting the stream quietly change shape.
 */
const STAFF_PERMISSIONS: readonly string[] = [
  'orders.read',
  'orders.create',
  'orders.update',
  'inventory.read',
  'designs.read',
  'pos.read',
  'payments.read',
  'payments.create',
  'settings.read',
  'customers.read',
  'order_payments.read',
  'order_payments.create',
];

/** `admin` is granted every permission by a cross join in the seed. */
const ADMIN_PERMISSIONS: readonly string[] = Object.values(DOMAIN_READ_PERMISSION);

describe('services/dataChangePermissions', () => {
  describe('DOMAIN_READ_PERMISSION', () => {
    it('covers every domain', () => {
      assert.equal(DATA_DOMAINS.length, 7);
      assert.deepEqual([...DATA_DOMAINS].sort(), [
        'customers',
        'designs',
        'inventory',
        'orders',
        'payments',
        'settings',
        'users',
      ]);
    });

    it('maps each domain to a dot-namespaced read capability', () => {
      for (const domain of DATA_DOMAINS) {
        assert.equal(
          DOMAIN_READ_PERMISSION[domain],
          `${domain}.read`,
          `${domain} should be gated by ${domain}.read`,
        );
      }
    });
  });

  describe('visibleDomainsFor', () => {
    it('gives an admin every domain', () => {
      assert.deepEqual(visibleDomainsFor(ADMIN_PERMISSIONS).sort(), [...DATA_DOMAINS].sort());
    });

    it('gives staff every domain except users', () => {
      const visible = visibleDomainsFor(STAFF_PERMISSIONS);
      assert.deepEqual(visible.sort(), ['customers', 'designs', 'inventory', 'orders', 'payments', 'settings']);
      // The one admin-only domain. Asserted separately so a failure names the
      // leak rather than just showing two different arrays.
      assert.ok(!visible.includes('users'), 'staff must not receive user-management events');
    });

    it('grants nothing without permissions', () => {
      assert.deepEqual(visibleDomainsFor([]), []);
    });

    it('ignores capabilities that gate no domain', () => {
      // `orders.delete`, `inventory.manage` and friends are real capabilities,
      // but none of them is a *read* gate for a domain.
      assert.deepEqual(visibleDomainsFor(['orders.delete', 'inventory.manage', 'users.manage']), []);
    });

    it('ignores unknown permissions', () => {
      assert.deepEqual(visibleDomainsFor(['not.a.permission', 'orders.read']), ['orders']);
    });

    it('does not treat `order_payments.read` as `payments.read`', () => {
      // The underscore is deliberate in the permission model, and the two
      // capabilities gate different things: order payments are per-order
      // instalments, `payments` is the retail transaction ledger. A prefix match
      // here would leak the sales ledger to anyone who can read order payments.
      assert.deepEqual(visibleDomainsFor(['order_payments.read']), []);
    });

    it('requires the `.read` capability, not a management one', () => {
      assert.deepEqual(visibleDomainsFor(['users.manage']), []);
      assert.deepEqual(visibleDomainsFor(['users.read']), ['users']);
    });

    it('returns each domain at most once', () => {
      const visible = visibleDomainsFor(['orders.read', 'orders.read', 'inventory.read']);
      assert.deepEqual(visible, ['orders', 'inventory']);
    });
  });
});
