export type PaymentMethod = 'Cash' | 'Card' | 'Custom Order';
export type TransactionStatus = 'completed' | 'voided';

export interface TransactionItem {
  itemId?: string;
  name: string;
  quantity: number;
  /**
   * The rate actually charged for this line — NOT necessarily the catalogue
   * price. The till can override a line's rate, and the sale RPC stores what it
   * is given instead of re-pricing from the catalogue.
   */
  unitPrice: number;
  /**
   * Discount applied to this line alone, in currency.
   *
   * Optional because the server defaults it to 0; the sale RPC writes the
   * column, so the API always returns it on a read. A missing value means "no
   * discount", never "unknown".
   */
  lineDiscount?: number;
}

export interface Transaction {
  id: string;
  status: TransactionStatus;
  items: TransactionItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentAmount: number;
  /**
   * Who the sale was for. Empty string — never absent — for an anonymous
   * walk-in sale, because the column is `not null default ''`. A custom order
   * requires a customer; a retail sale does not.
   */
  customer: string;
  customerId?: string;
  date: string;
}

/**
 * The create-side shape of a sale.
 *
 * `status` is omitted rather than made optional, because it is not the client's
 * to send. The server owns it: the sale RPC writes `completed` the moment the
 * sale commits, and the only route to `voided` is the separate void endpoint. A
 * client able to set it could claim a state the ledger never passed through, so
 * the contract does not offer the field at all. This matches the API, whose
 * `TransactionInput` has never carried a `status`.
 */
export type CreateTransaction = Omit<Transaction, 'id' | 'date' | 'status' | 'customer'> & {
  /**
   * Optional, unlike on the read shape. A retail sale is legitimately anonymous
   * — the API accepts a blank customer and stores `''` — so requiring the field
   * here would force every caller to send an empty string to say "no customer".
   */
  customer?: string;
};

/**
 * The structured context the API attaches when a sale is rejected because stock
 * ran short, carried on the `INSUFFICIENT_STOCK` (409) response.
 *
 * It exists so the POS can point at the offending cart line and say how many are
 * actually left, instead of showing a bare "the transaction could not be
 * completed" banner that leaves the cashier guessing. Kept here, rather than
 * duplicated, so the side that raises it and the side that renders it cannot
 * drift apart.
 */
export interface InsufficientStockDetails {
  itemId: string;
  itemName: string;
  available: number;
  requested: number;
}
