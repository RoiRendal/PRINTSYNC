import { apiClient, type ApiClient } from '../../../shared/api/client';
import type { PaginatedResponse } from '@printsync/shared-types';
import type { CreateCustomer, Customer, UpdateCustomer } from '@printsync/shared-types';

export function createCustomersApi(client: ApiClient = apiClient) {
  return {
    list: (query?: { page?: number; limit?: number }) => client.get<PaginatedResponse<Customer>>('/customers', query),
    create: (payload: CreateCustomer) => client.post<Customer, CreateCustomer>('/customers', payload),
    update: (id: string, payload: UpdateCustomer) => client.patch<Customer, UpdateCustomer>(`/customers/${id}`, payload),
    remove: (id: string) => client.delete<void>(`/customers/${id}`),
    /**
     * How many orders point at this customer.
     *
     * Read before the delete is confirmed, so the warning can name the number
     * rather than asking staff to accept an unquantified "this may affect orders".
     * Gated on `customers.read`, so staff can see it even though only an admin can
     * perform the delete itself.
     */
    orderCount: (id: string) => client.get<{ orderCount: number }>(`/customers/${id}/order-count`),
  };
}

export const customersApi = createCustomersApi();
