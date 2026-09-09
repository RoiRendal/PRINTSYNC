import { apiClient, type ApiClient } from '../../../shared/api/client';
import type { InventoryItem } from '../types';

export type CreateInventoryItem = Omit<InventoryItem, 'id'>;
export type UpdateInventoryItem = Partial<CreateInventoryItem>;

export function createInventoryApi(client: ApiClient = apiClient) {
  return {
    list: () => client.get<InventoryItem[]>('/inventory'),
    create: (payload: CreateInventoryItem) => client.post<InventoryItem, CreateInventoryItem>('/inventory', payload),
    update: (id: string, payload: UpdateInventoryItem) => client.patch<InventoryItem, UpdateInventoryItem>(`/inventory/${id}`, payload),
    remove: (id: string) => client.delete<void>(`/inventory/${id}`),
  };
}

export const inventoryApi = createInventoryApi();
