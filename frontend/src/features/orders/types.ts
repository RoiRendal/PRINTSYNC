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
  item: string;
  lineItems?: OrderLineItem[];
  quantity: number;
  status: OrderStatus;
  date: string;
  amount: number;
  designId?: string;
  notes?: string;
  isCustom?: boolean;
}

export type CreateOrder = Omit<Order, 'id' | 'date'>;
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
}
