import { apiClient, type ApiClient } from '../../../shared/api/client';
import type { OrderPayment, CreateOrderPayment } from '@printsync/shared-types';

// The order-payment contract is shared; re-export it so the API and the store agree.
export type { OrderPayment, CreateOrderPayment };

// Derived from the shared method union so the two cannot drift apart.
export type OrderPaymentMethod = OrderPayment['method'];

export function createOrderPaymentsApi(client: ApiClient = apiClient) {
  return {
    list: (orderId: string) => client.get<OrderPayment[]>(`/order-payments/${orderId}`),
    create: (payload: CreateOrderPayment) => client.post<OrderPayment, CreateOrderPayment>('/order-payments', payload),
  };
}

export const orderPaymentsApi = createOrderPaymentsApi();
