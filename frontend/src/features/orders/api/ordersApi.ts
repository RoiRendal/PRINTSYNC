import { apiClient, type ApiClient } from '../../../shared/api/client';
import type { Order } from '../types';

export type CreateOrder = Omit<Order, 'id' | 'date'>;
export type UpdateOrder = Partial<CreateOrder>;

export function createOrdersApi(client: ApiClient = apiClient) {
  return {
    list: () => client.get<Order[]>('/orders'),
    get: (id: string) => client.get<Order>(`/orders/${id}`),
    create: (payload: CreateOrder) => client.post<Order, CreateOrder>('/orders', payload),
    update: (id: string, payload: UpdateOrder) => client.patch<Order, UpdateOrder>(`/orders/${id}`, payload),
    remove: (id: string) => client.delete<void>(`/orders/${id}`),
  };
}

export const ordersApi = createOrdersApi();
