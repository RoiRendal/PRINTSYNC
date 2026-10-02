import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type {
  AuditLogRecord as SharedAuditLogRecord,
  Design as SharedDesign,
  Expense as SharedExpense,
  InventoryItem as SharedInventoryItem,
  Order as SharedOrder,
  OrderLineItem as SharedOrderLineItem,
  OrderPayment as SharedOrderPayment,
  OrdersSummary as SharedOrdersSummary,
  SessionUser as SharedSessionUser,
  Supplier as SharedSupplier,
  Transaction as SharedTransaction,
  UserSummary as SharedUserSummary,
} from '@printsync/shared-types';

import type { AuditLogRecord } from '../../src/modules/audit/audit.service.js';
import type { DesignRecord } from '../../src/modules/designs/designs.service.js';
import type { Expense } from '../../src/modules/expenses/expenses.service.js';
import type { InventoryItem } from '../../src/modules/inventory/inventory.service.js';
import type { OrderLineItem, OrderRecord, OrdersSummary } from '../../src/modules/orders/orders.service.js';
import type { OrderPayment } from '../../src/modules/orderPayments/orderPayments.service.js';
import type { TransactionRecord } from '../../src/modules/payments/payments.service.js';
import type { Supplier } from '../../src/modules/suppliers/suppliers.service.js';
import type { UserSummary } from '../../src/modules/users/users.service.js';
import { sessionUserPayload } from '../../src/routes/auth.routes.js';

/**
 * The shape `/login`, `/refresh` and `/session` return.
 *
 * `ReturnType` of the one helper all three routes now share, so this assertion
 * tracks the real serialiser rather than a hand-copied interface that could drift
 * from it — which is precisely how the fields went missing.
 */
type SessionPayload = ReturnType<typeof sessionUserPayload>;

/**
 * The API's record types must agree with the published contract, in both
 * directions. This file is the check; `tsc` is what runs it, via `npm run
 * lint:tests` in CI.
 *
 * ### Why it exists
 *
 * `packages/shared-types` is the contract the frontend codes against, and every
 * service in this API declares its own record type. Nothing connected the two, so
 * they could drift in silence — and they did. `Order.updatedAt` was in the API's
 * `OrderRecord` and in the frontend's own hand-copied type, but was **missing from
 * the shared `Order`**. That field is the compare-and-swap token for order edits,
 * so the published contract was silent about the one field the optimistic-
 * concurrency guard depends on, and no test could notice because the contract and
 * the API never met.
 *
 * The same check immediately found a second instance: `OrderPayment.createdBy` was
 * sent by the API and mentioned nowhere in the contract.
 *
 * ### What it is not
 *
 * It does not force the services to import the shared types. Each keeps its own
 * record type, which is what lets a service be refactored without the frontend
 * noticing; the assertion is that the two describe the same shape.
 */

/**
 * Drops `| undefined` from every property type, recursively.
 *
 * This API's tsconfig sets `exactOptionalPropertyTypes`, so a mapper that assigns
 * `undefined` explicitly — `customerId: row.customer_id ? String(...) : undefined`
 * — has to declare `customerId?: string | undefined`. The contract describes the
 * wire shape and says `customerId?: string`, because on the wire the key is either
 * absent or a string; it is never the value `undefined`.
 *
 * Both spellings mean the same thing here, so the difference is which tsconfig
 * built each side rather than a disagreement about the data. Removing it is what
 * keeps the assertions below about the contract, and stops ~20 harmless
 * `| undefined` markers from burying the one line that is a real defect.
 *
 * Recursion matters: a non-recursive version normalises `Order.customerId` but
 * leaves `Order.lineItems[].itemId` alone, so the nested types still report a
 * mismatch that is only the compiler flag again.
 */
type WireShape<T> = T extends undefined
  ? never
  : T extends readonly (infer U)[]
    ? Array<WireShape<U>>
    : T extends object
      ? { [K in keyof T]: WireShape<T[K]> }
      : T;

/** `true` only when `Api` provides every property `Contract` promises. */
type Provides<Api, Contract> = WireShape<Api> extends WireShape<Contract> ? true : false;

/** Compile error unless its argument is exactly `true`. */
type Expect<T extends true> = T;

/**
 * Every pair the frontend can receive from this API.
 *
 * Both directions are asserted for each pair. `Provides<Api, Contract>` catches a
 * contract field the API never sends — which reaches the browser as `undefined`
 * and reads as a frontend bug. `Provides<Contract, Api>` catches a field the API
 * sends that the contract forgot to mention — which is how `updatedAt` and
 * `OrderPayment.createdBy` went missing.
 */
export type ApiMatchesPublishedContract = [
  Expect<Provides<OrderRecord, SharedOrder>>,
  Expect<Provides<SharedOrder, OrderRecord>>,
  Expect<Provides<OrderLineItem, SharedOrderLineItem>>,
  Expect<Provides<SharedOrderLineItem, OrderLineItem>>,
  Expect<Provides<TransactionRecord, SharedTransaction>>,
  Expect<Provides<SharedTransaction, TransactionRecord>>,
  Expect<Provides<InventoryItem, SharedInventoryItem>>,
  Expect<Provides<SharedInventoryItem, InventoryItem>>,
  Expect<Provides<DesignRecord, SharedDesign>>,
  Expect<Provides<SharedDesign, DesignRecord>>,
  Expect<Provides<UserSummary, SharedUserSummary>>,
  Expect<Provides<SharedUserSummary, UserSummary>>,
  // The session payload. `SharedSessionUser` is what the frontend's `AuthUser`
  // is built from, and the frontend reads `role`, `branchId` and
  // `canViewAllBranches` off it. All three were absent from the payload while
  // being present in the contract, which clamped every account — admin included —
  // to the staff page list and bounced Analytics, Users, Settings and Audit Log
  // back to the Dashboard. Adding this pair is what makes that a compile error.
  Expect<Provides<SessionPayload, SharedSessionUser>>,
  Expect<Provides<SharedSessionUser, SessionPayload>>,
  Expect<Provides<AuditLogRecord, SharedAuditLogRecord>>,
  Expect<Provides<SharedAuditLogRecord, AuditLogRecord>>,
  Expect<Provides<Expense, SharedExpense>>,
  Expect<Provides<SharedExpense, Expense>>,
  Expect<Provides<Supplier, SharedSupplier>>,
  Expect<Provides<SharedSupplier, Supplier>>,
  Expect<Provides<OrderPayment, SharedOrderPayment>>,
  Expect<Provides<SharedOrderPayment, OrderPayment>>,
  Expect<Provides<OrdersSummary, SharedOrdersSummary>>,
  Expect<Provides<SharedOrdersSummary, OrdersSummary>>,
];

describe('the API and the published contract agree', () => {
  it('carries the compare-and-swap token the order editor depends on', () => {    // The concrete field that went missing. A runtime assertion as well as the
    // compile-time one above, because this is the field whose absence caused the
    // defect and a reader should be able to see what it protects.
    const record: OrderRecord = {
      id: 'order-1',
      customer: 'Walk-in',
      item: 'Tarpaulin 3x4',
      lineItems: [],
      quantity: 0,
      status: 'Pending',
      date: '2026-09-21',
      updatedAt: '2026-09-21T09:15:00.123456+00:00',
      amount: 0,
      totalPaid: 0,
      balanceDue: 0,
      notes: '',
      isCustom: false,
    };

    // Read through the published type. `SharedOrder['updatedAt']` is the contract's
    // own view of the field; if the contract did not declare it, this line would not
    // compile — which is exactly what happened before the fix.
    const contract: SharedOrder['updatedAt'] = record.updatedAt;

    // Echoed back verbatim: the microseconds are part of the token, so a client
    // that parsed and re-serialised it would make every save look like a conflict.
    assert.equal(contract, '2026-09-21T09:15:00.123456+00:00');
  });

  it('reports the role, branch and head-office flag the session is for', () => {
    // The runtime half of the assertion above. `Provides` proves the shape
    // compiles; this proves the values actually travel, because the defect was
    // silent in exactly the way a compile-time check cannot cover: the fields
    // existed on the auth context and were simply never copied out.
    const owner = sessionUserPayload({
      user: { id: 'u-1', email: 'owner@printsync.com' },
      profile: {
        id: 'u-1',
        name: 'Owner',
        phone: '09170000000',
        position: 'Owner',
        roleId: 'role-owner',
        role: 'owner',
        branchId: 'branch-bal',
        canViewAllBranches: true,
      },
      permissions: ['analytics.read', 'users.read'],
    } as unknown as Parameters<typeof sessionUserPayload>[0]);

    // Without `role`, `isAdminTier(undefined)` is false and the account is clamped
    // to the staff page list — which is what removed Analytics, Users, Settings and
    // the Audit Log from the sidebar.
    assert.equal(owner.role, 'owner');
    // Without this the head-office branch picker never renders and the whole
    // cross-branch comparison feature is unreachable.
    assert.equal(owner.canViewAllBranches, true);
    // Without this the account cannot be labelled as belonging to a branch.
    assert.equal(owner.branchId, 'branch-bal');

    // A staff account must still report its own branch and no cross-branch reach.
    const staff = sessionUserPayload({
      user: { id: 'u-2', email: 'noah@printsync.com' },
      profile: {
        id: 'u-2',
        name: 'Noah',
        phone: '09170000001',
        position: 'Cashier',
        roleId: 'role-staff',
        role: 'staff',
        branchId: 'branch-bal',
        canViewAllBranches: false,
      },
      permissions: ['orders.read'],
    } as unknown as Parameters<typeof sessionUserPayload>[0]);

    assert.equal(staff.role, 'staff');
    assert.equal(staff.canViewAllBranches, false);
    assert.equal(staff.branchId, 'branch-bal');
  });
});
