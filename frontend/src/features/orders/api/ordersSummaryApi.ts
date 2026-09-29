import { apiClient, type ApiClient } from '../../../shared/api/client';
import type { OrdersSummary } from '../../orders/types';

/**
 * The Workspace's counts — one endpoint, one request.
 *
 * The Dashboard used to compute its numbers in the browser from page 1 of the
 * orders and inventory lists, so "Active Orders" under-reported and a figure
 * beside orders carrying real values could read zero. `GET /orders/summary`
 * replaces that with counts taken over the whole table, in the database.
 *
 * ### Why this lives in the orders feature
 *
 * The path is `/orders/summary` and the gate is `orders.read`, so it belongs with
 * the orders code even though the payload is not a single order or a list — it is a
 * Workspace snapshot: order counts by status **plus** `lowStock`, which is inventory.
 * The Dashboard and the Orders page both consume these counts, and both must show the
 * same numbers, so the one source lives here rather than being duplicated. The shape
 * is owned by `@printsync/shared-types`; this module only says where to fetch it.
 *
 * ### Failure is loud
 *
 * There is deliberately no fallback here, and none in the hook that calls it. A
 * previous service in this codebase carried a second implementation that hid a
 * broken RPC for months. If the summary cannot be read, the page says so — it does
 * not quietly render zeros, because a screen of zeros looks like a quiet morning
 * rather than a broken query.
 */
export function createOrdersSummaryApi(client: ApiClient = apiClient) {
  return {
    summary: () => client.get<OrdersSummary>('/orders/summary'),
  };
}

export const ordersSummaryApi = createOrdersSummaryApi();
