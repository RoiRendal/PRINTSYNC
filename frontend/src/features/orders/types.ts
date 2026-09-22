import type { InventoryItem } from '../inventory/types';

// The order contract lives in `@printsync/shared-types` — `Order`, `OrderStatus`,
// `OrderLineItem`, `CreateOrder` and `UpdateOrder` are re-exported from there so the
// version token (`updatedAt`) can never be silently dropped by a local re-copy. The
// types below are frontend-only: the POS basket, the till's transaction row, and the
// checkout method union.
export type {
  OrderLineItem,
  OrderStatus,
  Order,
  CreateOrder,
  UpdateOrder,
  PaymentMethod,
} from '@printsync/shared-types';

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

export interface OrderPaymentRecord {
  id: string;
  orderId: string;
  amount: number;
  method: 'Cash' | 'Card' | 'Other';
  notes: string;
  createdAt: string;
}
