import { apiClient, type ApiClient } from '../../../shared/api/client';
import type { CreateInventoryItem, InventoryItem, UpdateInventoryItem } from '../types';

export function createInventoryApi(client: ApiClient = apiClient) {
  return {
    list: () => client.get<InventoryItem[]>('/inventory'),
    create: (payload: CreateInventoryItem) => client.post<InventoryItem, CreateInventoryItem>('/inventory', payload),
    update: (id: string, payload: UpdateInventoryItem) => client.patch<InventoryItem, UpdateInventoryItem>(`/inventory/${id}`, payload),
    remove: (id: string) => client.delete<void>(`/inventory/${id}`),
  };
}

export const inventoryApi = createInventoryApi();
