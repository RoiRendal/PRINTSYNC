import { apiClient, type ApiClient } from '../../../shared/api/client';
import type { PaginatedResponse } from '@printsync/shared-types';
import type { CreateInventoryItem, InventoryItem, UpdateInventoryItem } from '../types';

/**
 * The inventory list's domain filter, declared next to the request that sends it.
 *
 * `lowStock: 1` asks the server for items at or below their reorder level
 * (`GET /inventory?lowStock=1`). It is the number `1` rather than a `boolean`
 * because the API client serialises primitives into query parameters, and the
 * server turns the filter on only for `1`/`true`. Omitting the key means "show
 * everything", which is how the filter is cleared.
 */
export type InventoryListFilters = { lowStock?: 1 };

export function createInventoryApi(client: ApiClient = apiClient) {
  return {
    list: (query?: { page?: number; limit?: number } & InventoryListFilters) =>
      client.get<PaginatedResponse<InventoryItem>>('/inventory', query),
    create: (payload: CreateInventoryItem) => client.post<InventoryItem, CreateInventoryItem>('/inventory', payload),
    update: (id: string, payload: UpdateInventoryItem) => client.patch<InventoryItem, UpdateInventoryItem>(`/inventory/${id}`, payload),
    adjust: (id: string, payload: { quantity: number; reason: string }) =>
      client.post<InventoryItem, { quantity: number; reason: string }>(`/inventory/${id}/movements`, payload),
    remove: (id: string) => client.delete<void>(`/inventory/${id}`),
  };
}

export const inventoryApi = createInventoryApi();
