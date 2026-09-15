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
