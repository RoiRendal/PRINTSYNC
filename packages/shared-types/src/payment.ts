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

export type CreateTransaction = Omit<Transaction, 'id' | 'date'>;

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
