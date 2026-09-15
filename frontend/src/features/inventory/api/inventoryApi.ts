import { apiClient, type ApiClient } from '../../../shared/api/client';
import type { PaginatedResponse } from '@printsync/shared-types';
import type { CreateInventoryItem, InventoryItem, UpdateInventoryItem } from '../types';

export function createInventoryApi(client: ApiClient = apiClient) {
  return {
    list: (query?: { page?: number; limit?: number }) => client.get<PaginatedResponse<InventoryItem>>('/inventory', query),
    create: (payload: CreateInventoryItem) => client.post<InventoryItem, CreateInventoryItem>('/inventory', payload),
    update: (id: string, payload: UpdateInventoryItem) => client.patch<InventoryItem, UpdateInventoryItem>(`/inventory/${id}`, payload),
    adjust: (id: string, payload: { quantity: number; reason: string }) =>
      client.post<InventoryItem, { quantity: number; reason: string }>(`/inventory/${id}/movements`, payload),
    remove: (id: string) => client.delete<void>(`/inventory/${id}`),
  };
}

export const inventoryApi = createInventoryApi();
