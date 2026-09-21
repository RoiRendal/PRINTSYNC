import { apiClient, type ApiClient } from '../../../shared/api/client';

export type OrderPaymentMethod = 'Cash' | 'Card' | 'Other';

export interface OrderPayment {
  id: string;
  orderId: string;
  amount: number;
  method: OrderPaymentMethod;
  notes: string;
  createdBy?: string;
  createdAt: string;
}

export interface CreateOrderPayment {
  orderId: string;
  amount: number;
  method: OrderPaymentMethod;
  notes?: string;
}

export function createOrderPaymentsApi(client: ApiClient = apiClient) {
  return {
    list: (orderId: string) => client.get<OrderPayment[]>(`/order-payments/${orderId}`),
    create: (payload: CreateOrderPayment) => client.post<OrderPayment, CreateOrderPayment>('/order-payments', payload),
  };
}

export const orderPaymentsApi = createOrderPaymentsApi();
