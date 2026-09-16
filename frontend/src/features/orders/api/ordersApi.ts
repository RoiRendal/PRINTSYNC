import { apiClient, type ApiClient } from '../../../shared/api/client';
import { readApiErrorBody } from '../../../shared/api/errors';
import type { OrderConflictDetails, PaginatedResponse } from '@printsync/shared-types';
import type { CreateOrder, Order, UpdateOrder } from '../types';

/**
 * Reads the conflict context off a refused order save.
 *
 * The API answers a lost race with `409 ORDER_CONFLICT` and both versions, so the
 * UI can say what happened and pull the other person's edit. Returns `null` for
 * every other failure, letting the caller fall back to the generic message rather
 * than mistaking an unrelated error for a conflict.
 */
export function readOrderConflict(error: unknown): OrderConflictDetails | null {
  const body = readApiErrorBody(error);
  if (!body || body.code !== 'ORDER_CONFLICT') return null;

  const details = body.details;
  if (!details || typeof details !== 'object') return null;

  const candidate = details as Record<string, unknown>;
  if (
    typeof candidate.orderId !== 'string' ||
    typeof candidate.expectedUpdatedAt !== 'string' ||
    typeof candidate.currentUpdatedAt !== 'string'
  ) {
    return null;
  }

  return {
    orderId: candidate.orderId,
    expectedUpdatedAt: candidate.expectedUpdatedAt,
    currentUpdatedAt: candidate.currentUpdatedAt,
  };
}

export function createOrdersApi(client: ApiClient = apiClient) {
  return {
    list: (query?: { page?: number; limit?: number }) => client.get<PaginatedResponse<Order>>('/orders', query),
    get: (id: string) => client.get<Order>(`/orders/${id}`),
    create: (payload: CreateOrder) => client.post<Order, CreateOrder>('/orders', payload),
    /**
     * @param expectedUpdatedAt the version this edit was based on, taken from the
     *   order as it was loaded. The server refuses the save if the order has moved
     *   on since, so two staff editing the same order cannot silently overwrite
     *   each other.
     */
    update: (id: string, payload: UpdateOrder, expectedUpdatedAt: string) =>
      client.patch<Order, UpdateOrder & { expectedUpdatedAt: string }>(`/orders/${id}`, {
        ...payload,
        expectedUpdatedAt,
      }),
    remove: (id: string) => client.delete<void>(`/orders/${id}`),
  };
}

export const ordersApi = createOrdersApi();
