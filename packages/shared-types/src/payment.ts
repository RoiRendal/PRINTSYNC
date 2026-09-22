export type PaymentMethod = 'Cash' | 'Card' | 'Custom Order';
export type TransactionStatus = 'completed' | 'voided';

export interface TransactionItem {
  itemId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
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
export type CreateTransaction = Omit<Transaction, 'id' | 'date' | 'status'>;

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
