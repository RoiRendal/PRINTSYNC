import type { InventoryItem } from '../inventory/types';

export interface OrderLineItem {
  itemId?: string;
  name: string;
  quantity: number;
  designId?: string;
  unitPrice?: number;
}

export type OrderStatus =
  | 'Pending'
  | 'In Production'
  | 'Ready for Pickup'
  | 'Designing'
  | 'Completed'
  | 'Delivered';

export interface Order {
  id: string;
  customer: string;
  customerId?: string;
  item: string;
  lineItems?: OrderLineItem[];
  quantity: number;
  status: OrderStatus;
  date: string;
  /**
   * The row's version token, as the server sent it.
   *
   * Echo it back untouched on the next save — it names the version this screen is
   * working from, and the server refuses the write if the order has moved on since
   * (someone else edited it). Do not run it through `new Date()`: parsing and
   * re-serialising drops the microseconds, which would make every save look like a
   * conflict.
   */
  updatedAt: string;
  amount: number;
  totalPaid?: number;
  balanceDue?: number;
  dueDate?: string;
  designId?: string;
  notes?: string;
  isCustom?: boolean;
}

export type CreateOrder = Omit<Order, 'id' | 'date' | 'updatedAt'>;
export type UpdateOrder = Partial<CreateOrder>;

export interface CartItem extends InventoryItem {
  qty: number;
  isCustom?: boolean;
  designId?: string;
  notes?: string;
}

export interface Transaction {
  id: string;
  date: string;
  items: CartItem[];
  subtotal: number;
  discount?: number;
  vatRatePercent?: number;
  tax: number;
  total: number;
  paymentMethod: 'Cash' | 'Card' | 'Custom Order';
  status?: 'completed' | 'voided';
}

export type PaymentMethod = 'Cash' | 'Card' | 'Custom Order';

export interface OrderPaymentRecord {
  id: string;
  orderId: string;
  amount: number;
  method: 'Cash' | 'Card' | 'Other';
  notes: string;
  createdAt: string;
}
