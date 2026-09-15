import { apiClient, type ApiClient } from '../../../shared/api/client';
import type { PaginatedResponse } from '@printsync/shared-types';
import type { CreateCustomer, Customer, UpdateCustomer } from '@printsync/shared-types';

export function createCustomersApi(client: ApiClient = apiClient) {
  return {
    list: (query?: { page?: number; limit?: number }) => client.get<PaginatedResponse<Customer>>('/customers', query),
    get: (id: string) => client.get<Customer>(`/customers/${id}`),
    create: (payload: CreateCustomer) => client.post<Customer, CreateCustomer>('/customers', payload),
    update: (id: string, payload: UpdateCustomer) => client.patch<Customer, UpdateCustomer>(`/customers/${id}`, payload),
    remove: (id: string) => client.delete<void>(`/customers/${id}`),
  };
}

export const customersApi = createCustomersApi();
