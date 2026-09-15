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
  amount: number;
  totalPaid: number;
  balanceDue: number;
  designId?: string;
  notes: string;
  isCustom: boolean;
}

export type CreateOrder = Omit<Order, 'id' | 'date' | 'totalPaid' | 'balanceDue' | 'item' | 'quantity'> & {
  lineItems: OrderLineItem[];
};

export type UpdateOrder = Partial<CreateOrder>;

export interface OrderPayment {
  id: string;
  orderId: string;
  amount: number;
  method: 'Cash' | 'Card' | 'Other';
  notes: string;
  createdAt: string;
}

export type CreateOrderPayment = Omit<OrderPayment, 'id' | 'createdAt'>;
