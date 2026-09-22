/**
 * The frontend's view of the domain must be the published contract — not a
 * near-copy of it.
 *
 * ### Why this file exists
 *
 * `packages/shared-types` is the contract; every feature module used to hand-copy
 * the types it needed. The copies drifted, and the drift was invisible: the
 * frontend's `Order` declared `updatedAt` while the shared `Order` did not, so the
 * published contract was silent about the one field the order editor's
 * compare-and-swap depends on. A frontend that had trusted the contract would have
 * lost the version token and turned every save into a conflict.
 *
 * R7/1.5 fixed the copies — each feature module now re-exports from the package.
 * That removes today's drift. This file is what stops tomorrow's: it asserts, at
 * compile time, that each module's exported type is *the same type* as the one the
 * package publishes. Re-introduce a hand-written copy — drop `updatedAt`, make
 * `lineItems` optional, widen a union — and `npm run lint` fails here, naming the
 * pair that diverged.
 *
 * ### Why it is not a test
 *
 * It runs under `tsc`, which CI already runs on every push and pull request
 * (`frontend` job, "Type-check"). There is nothing to execute, so there is no way
 * to forget to run it and no test runtime to pay for. Deleting an assertion here
 * is the only way to silence it, and that is a visible diff.
 *
 * ### What it cannot see
 *
 * It checks types, not values. A module that re-exports the contract but mangles
 * the data on the way through is outside its reach — that is what the feature's
 * own tests are for. `scripts/check-shared-types.mjs` covers the other half: it
 * reads the source and refuses a *declaration* of a package-owned name.
 */
import type {
  AuditLogRecord as SharedAuditLogRecord,
  AuthResponse as SharedAuthResponse,
  CreateCustomer as SharedCreateCustomer,
  CreateDesign as SharedCreateDesign,
  CreateInventoryItem as SharedCreateInventoryItem,
  CreateOrder as SharedCreateOrder,
  CreateOrderPayment as SharedCreateOrderPayment,
  CreateTransaction as SharedCreateTransaction,
  CreateUserInput as SharedCreateUserInput,
  Customer as SharedCustomer,
  Design as SharedDesign,
  InventoryItem as SharedInventoryItem,
  ListAuditLogsResult as SharedListAuditLogsResult,
  Order as SharedOrder,
  OrderLineItem as SharedOrderLineItem,
  OrderPayment as SharedOrderPayment,
  OrderStatus as SharedOrderStatus,
  PaymentMethod as SharedPaymentMethod,
  SessionUser as SharedSessionUser,
  Transaction as SharedTransaction,
  TransactionItem as SharedTransactionItem,
  UpdateCustomer as SharedUpdateCustomer,
  UpdateDesign as SharedUpdateDesign,
  UpdateInventoryItem as SharedUpdateInventoryItem,
  UpdateOrder as SharedUpdateOrder,
  UpdateUserInput as SharedUpdateUserInput,
  UserRole as SharedUserRole,
  UserSummary as SharedUserSummary,
} from '@printsync/shared-types';

import type { AuditLogListResult, AuditLogRecord, ListAuditLogsResult } from '../../features/audit/types';
import type { Customer, CreateCustomer, UpdateCustomer } from '../../features/customers/types';
import type { CreateDesign, Design, UpdateDesign } from '../../features/designs/types';
import type {
  CreateInventoryItem,
  InventoryItem,
  UpdateInventoryItem,
} from '../../features/inventory/types';
import type { CreateOrderPayment, OrderPayment } from '../../features/orders/api/orderPaymentsApi';
import type {
  CreatePaymentTransaction,
  PaymentTransaction,
  PaymentTransactionItem,
} from '../../features/orders/api/paymentsApi';
import type {
  CartItem,
  CreateOrder,
  Order,
  OrderLineItem,
  OrderStatus,
  PaymentMethod,
  UpdateOrder,
} from '../../features/orders/types';
import type {
  AuthResponse,
  AuthUser,
  CreateUserInput,
  RbacRole,
  SessionUser,
  UpdateUserInput,
  UserRole,
  UserSummary,
} from '../../features/users/types';

/**
 * `true` only when `A` and `B` are the *same* type — not merely assignable to one
 * another.
 *
 * Plain mutual assignability would miss the defect this file exists to catch:
 * `{ a: string }` and `{ a?: string }` are mutually assignable in the loose
 * direction, so an optionality drift — the exact shape of the original bug, an
 * `updatedAt` that may be `undefined` at the moment it is compared — would pass a
 * sloppy check. The deferred-conditional identity trick compares the two types
 * structurally and exactly, including optional and readonly modifiers.
 */
type Identical<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** Compile error unless its argument is exactly `true`. */
type Expect<T extends true> = T;

/**
 * `true` when `A` and `B` are mutually assignable — the same data, allowing the
 * two spellings of it.
 *
 * Used only for the derived types below, where the frontend deliberately extends a
 * contract type instead of re-exporting it. `CartItem` is written as an
 * `interface CartItem extends InventoryItem`; the expression it should equal is an
 * intersection. Those are the same shape described two ways, and `Identical`
 * reports the spelling difference as a failure — which would make this file cry
 * wolf. What actually matters for a derived type is that it still *carries* the
 * contract half, and mutual assignability is exactly that assertion.
 */
type Equivalent<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/**
 * Every type the frontend takes from the contract, and the module that re-exports
 * it.
 *
 * Each pair must be `Identical`. A module that stops re-exporting and starts
 * declaring its own copy breaks its pair, and the error names the type.
 */
export type FrontendModulesPublishTheContract = [
  // orders — the domain the drift defect was found in.
  Expect<Identical<Order, SharedOrder>>,
  Expect<Identical<OrderLineItem, SharedOrderLineItem>>,
  Expect<Identical<OrderStatus, SharedOrderStatus>>,
  Expect<Identical<CreateOrder, SharedCreateOrder>>,
  Expect<Identical<UpdateOrder, SharedUpdateOrder>>,
  Expect<Identical<PaymentMethod, SharedPaymentMethod>>,

  // the till's transaction row, re-exported under the module's own alias.
  Expect<Identical<PaymentTransaction, SharedTransaction>>,
  Expect<Identical<PaymentTransactionItem, SharedTransactionItem>>,
  Expect<
    Identical<CreatePaymentTransaction, SharedCreateTransaction & { idempotencyKey: string }>
  >,

  // order payments.
  Expect<Identical<OrderPayment, SharedOrderPayment>>,
  Expect<Identical<CreateOrderPayment, SharedCreateOrderPayment>>,

  // inventory, designs, customers.
  Expect<Identical<InventoryItem, SharedInventoryItem>>,
  Expect<Identical<CreateInventoryItem, SharedCreateInventoryItem>>,
  Expect<Identical<UpdateInventoryItem, SharedUpdateInventoryItem>>,
  Expect<Identical<Design, SharedDesign>>,
  Expect<Identical<CreateDesign, SharedCreateDesign>>,
  Expect<Identical<UpdateDesign, SharedUpdateDesign>>,
  Expect<Identical<Customer, SharedCustomer>>,
  Expect<Identical<CreateCustomer, SharedCreateCustomer>>,
  Expect<Identical<UpdateCustomer, SharedUpdateCustomer>>,

  // users and the session.
  Expect<Identical<UserSummary, SharedUserSummary>>,
  Expect<Identical<CreateUserInput, SharedCreateUserInput>>,
  Expect<Identical<UpdateUserInput, SharedUpdateUserInput>>,
  Expect<Identical<SessionUser, SharedSessionUser>>,
  Expect<Identical<AuthResponse, SharedAuthResponse>>,
  Expect<Identical<UserRole, SharedUserRole>>,

  // audit.
  Expect<Identical<AuditLogRecord, SharedAuditLogRecord>>,
  Expect<Identical<ListAuditLogsResult, SharedListAuditLogsResult>>,
];

/**
 * The frontend-only types *derived* from the contract.
 *
 * These are not re-exports — they narrow or extend a shared type on purpose — so
 * they are not `Identical` to any bare shared type; the derivation is a real
 * difference, not drift. Each is asserted against the expression it is supposed to
 * be, using `Equivalent`, so a change to the underlying shared type still surfaces
 * here rather than at some distant call site.
 */
export type FrontendDerivedTypesStayDerived = [
  Expect<Identical<RbacRole, SharedUserRole>>,
  Expect<Identical<AuthUser, Omit<SharedUserSummary, 'createdAt'>>>,
  Expect<Identical<AuditLogListResult, SharedListAuditLogsResult>>,
  Expect<
    Equivalent<
      CartItem,
      SharedInventoryItem & {
        qty: number;
        isCustom?: boolean;
        designId?: string;
        notes?: string;
      }
    >
  >,
];

/**
 * The field that caused the defect, asserted on its own.
 *
 * The pairs above are the general guard; this is the specific one, so a reader can
 * see what it protects. `Order.updatedAt` is the compare-and-swap token for order
 * edits. If the contract ever drops it again, or the frontend's re-export stops
 * carrying it, this line is the error message.
 */
export type TheOrderVersionTokenIsStillInTheContract = [
  Expect<Identical<Order['updatedAt'], string>>,
  Expect<Identical<SharedOrder['updatedAt'], Order['updatedAt']>>,
];
