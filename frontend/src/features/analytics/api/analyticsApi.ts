import { apiClient, type ApiClient } from '../../../shared/api/client';

export interface AnalyticsSummary {
  range: { from: string; to: string };
  revenue: number;
  transactionCount: number;
  orderCount: number;
  averageTransactionValue: number;
  salesByDay: Array<{ date: string; revenue: number; transactions: number }>;
  ordersByStatus: Array<{ status: string; count: number }>;
  topItems: Array<{ name: string; quantity: number; revenue: number }>;
  inventoryAlerts: number;
}

export function createAnalyticsApi(client: ApiClient = apiClient) {
  return {
    summary: (from: string, to: string) =>
      client.get<AnalyticsSummary>(`/analytics/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  };
}

export const analyticsApi = createAnalyticsApi();