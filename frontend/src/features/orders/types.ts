import type { InventoryItem } from '../inventory/types';

// The order contract lives in `@printsync/shared-types` — `Order`, `OrderStatus`,
// `OrderLineItem`, `CreateOrder` and `UpdateOrder` are re-exported from there so the
// version token (`updatedAt`) can never be silently dropped by a local re-copy.
// `OrderStatusCount` and `OrdersSummary` join them for the same reason: the
// Workspace's counts are a server result, and a local copy of the shape would let
// the page and the endpoint disagree without anything failing. The types below are
// frontend-only: the POS basket, the till's transaction row, and the checkout
// method union.
export type {
  OrderLineItem,
  OrderStatus,
  Order,
  OrderStatusCount,
  OrdersSummary,
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
