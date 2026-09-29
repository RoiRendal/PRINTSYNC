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
  /**
   * What the catalogue said this line's rate was when it was staged.
   *
   * `price` is the line's LIVE rate — the till can override it per line, and
   * both checkout paths send it as `unitPrice`. Keeping the catalogue value
   * alongside is what lets the item-details surface say "this was overridden"
   * and offer a way back. Without it an override is invisible and irreversible,
   * and a cashier who mistypes a rate has no way to notice or undo it.
   *
   * Client-only: it is never sent. The stored order carries `unitPrice`, which
   * is the overridden figure — the right thing to persist.
   */
  cataloguePrice?: number;
  /**
   * Discount applied to this line alone, in currency.
   *
   * Part of the GRAND discount, not a separate deduction: `useCartTotals` adds
   * the line discounts to the cart-level one and the sale RPC checks that the
   * grand total covers them. That is the model the database enforces — see
   * `20260930000200_sale_customer_and_line_discounts.sql` — so a line discount
   * can never be claimed without being taken off the total.
   */
  lineDiscount?: number;
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
