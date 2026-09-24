import type { OrderStatus } from '@printsync/shared-types';

/**
 * The one runtime list of order statuses.
 *
 * It used to be written out four times — the union in `@printsync/shared-types`, a
 * second copy of that union here in `orders.service.ts`, this array in
 * `orders.routes.ts`, and a fourth spelling in `scripts/seedDemoData.ts`. Four
 * copies agreed today, but nothing forced them to: adding a seventh status to two
 * of the four would have produced a Dashboard that silently under-counts and an
 * API that rejects a status the database accepts.
 *
 * ### Why the list lives here and not in the shared package
 *
 * `@printsync/shared-types` is consumed as **types only**, on purpose. The frontend
 * builds with no alias for it, so an accidental *value* import fails the build
 * instead of silently bundling the package; the backend has no runtime dependency
 * on it either — its `tsconfig` path points straight at `dist/index.d.ts`. So
 * `ORDER_STATUSES` cannot be imported from the package: it would type-check and
 * then throw `MODULE_NOT_FOUND` at runtime. The contract keeps the *type*, this
 * module keeps the *value*.
 *
 * ### What stops them drifting
 *
 * `OrderStatusesMatchTheContract` below, checked by `tsc`. `ORDER_STATUSES` is the
 * value the API validates against, `OrderStatus` is the type the contract publishes,
 * and the two assertions prove they are the same set — no entry the contract does
 * not know, and none of its statuses missing. Edit one without the other and the
 * type-check fails here, naming the direction that broke.
 */
export const ORDER_STATUSES = [
  'Pending',
  'In Production',
  'Ready for Pickup',
  'Designing',
  'Completed',
  'Delivered',
] as const;

/** Re-exported so callers take the status type from the list that defines it. */
export type { OrderStatus };

/** Compile error unless its argument is exactly `true`. */
type Expect<T extends true> = T;

/** Every entry in the array is a status the contract knows about. */
type EveryEntryIsAStatusInTheContract = typeof ORDER_STATUSES[number] extends OrderStatus
  ? true
  : false;

/** And every status the contract knows about appears in the array. */
type NoStatusInTheContractIsMissing = OrderStatus extends typeof ORDER_STATUSES[number]
  ? true
  : false;

export type OrderStatusesMatchTheContract = [
  Expect<EveryEntryIsAStatusInTheContract>,
  Expect<NoStatusInTheContractIsMissing>,
];
