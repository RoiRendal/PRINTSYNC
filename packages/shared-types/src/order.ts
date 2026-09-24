export type OrderStatus =
  | 'Pending'
  | 'In Production'
  | 'Ready for Pickup'
  | 'Designing'
  | 'Completed'
  | 'Delivered';

export interface OrderLineItem {
  itemId?: string;
  name: string;
  quantity: number;
  designId?: string;
  unitPrice: number;
}

export interface Order {
  id: string;
  customer: string;
  customerId?: string;
  dueDate?: string;
  item: string;
  lineItems: OrderLineItem[];
  quantity: number;
  status: OrderStatus;
  date: string;
  /**
   * The row's `updated_at`, handed to the client so its next save can name the
   * version it was working from. Passed back verbatim — it is a version token, not
   * a date to be parsed and re-formatted, and rounding it to milliseconds would
   * make every save look like a conflict.
   *
   * This field was missing here while `OrderRecord` in the API and the frontend's
   * local `Order` both declared it. The type is the contract, and the contract was
   * silent about the one field the compare-and-swap on the server depends on.
   * `backend/tests/unit/contract.test.ts` is what stops that happening again.
   */
  updatedAt: string;
  amount: number;
  totalPaid: number;
  balanceDue: number;
  designId?: string;
  notes: string;
  isCustom: boolean;
}

/**
 * `updatedAt` is omitted along with the other server-owned fields: a client
 * creating an order has no version to name yet. It comes back on the created row
 * and is echoed on every update from then on.
 */
export type CreateOrder = Omit<
  Order,
  'id' | 'date' | 'updatedAt' | 'totalPaid' | 'balanceDue' | 'item' | 'quantity'
> & {
  lineItems: OrderLineItem[];
};

export type UpdateOrder = Partial<CreateOrder>;

export interface OrderPayment {
  id: string;
  orderId: string;
  amount: number;
  method: 'Cash' | 'Card' | 'Other';
  notes: string;
  /**
   * Who recorded the payment. Optional because the API omits the key when the row
   * has no `created_by` — `JSON.stringify` drops an `undefined` value.
   *
   * Found by the contract guard in `backend/tests/unit/contract.test.ts`, and the
   * second instance of the same defect as `Order.updatedAt`: the API sent a field
   * the contract never mentioned.
   */
  createdBy?: string;
  createdAt: string;
}

export type CreateOrderPayment = Omit<OrderPayment, 'id' | 'createdAt'>;

/**
 * The structured context the API attaches when an order save is refused because
 * someone else changed the order first, carried on the `ORDER_CONFLICT` (409)
 * response.
 *
 * The editor sent `expectedUpdatedAt`; the row now carries `currentUpdatedAt`. It
 * exists so the UI can explain the conflict in one sentence and pull the other
 * person's version, instead of reporting a generic failure and leaving the user
 * to work out that their edit was based on a stale screen.
 */
export interface OrderConflictDetails {
  orderId: string;
  expectedUpdatedAt: string;
  currentUpdatedAt: string;
}

/** One row of `OrdersSummary.byStatus` — how many orders sit in one status. */
export interface OrderStatusCount {
  status: OrderStatus;
  count: number;
}

/**
 * The Workspace summary: **how much work is waiting**, computed in the database.
 *
 * It exists because the Dashboard used to derive these numbers in the browser from
 * page 1 of a 20-row list, so "Active Orders" silently under-reported and
 * "Today's Revenue" read ₱0 beside orders carrying real values. The counts here are
 * over the whole table, never a page.
 *
 * Two rules the consumer depends on:
 *
 * 1. **`byStatus` is zero-filled.** Every one of the six known statuses appears,
 *    carrying `0` when no order is in it. A card must be able to render a zero; a
 *    status that vanishes from the array would make a card disappear from the page.
 * 2. **It counts work waiting, not money.** `open` is the orders still moving —
 *    everything not `Completed` and not `Delivered`. Revenue is deliberately absent:
 *    it is a figure with a date range and belongs on Analytics, not here.
 *
 * `lowStock` rides along on an order-shaped payload on purpose: the Workspace's
 * cards are one screen fetched in one round trip, and splitting the inventory count
 * into a second request would only give the page two ways to disagree with itself.
 * It is the same predicate the inventory list applies at `?lowStock=1` — stock at or
 * below reorder level — so the two must agree.
 */
export interface OrdersSummary {
  /** Every order in the table, regardless of status. */
  total: number;
  /** Orders still moving: not `Completed`, not `Delivered`. */
  open: number;
  /** All six statuses, zero-filled. */
  byStatus: OrderStatusCount[];
  /** Inventory items at or below their reorder level. */
  lowStock: number;
}
