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

export type AnalyticsBucket = 'day' | 'week' | 'quarter';

export interface SalesTimelineBucket {
  label: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  margin: number;
  transactionCount: number;
}

export interface SalesTimeline {
  range: { from: string; to: string };
  bucket: AnalyticsBucket;
  buckets: SalesTimelineBucket[];
}

export interface ProductTrendBucket {
  label: string;
  items: Array<{ name: string; quantity: number }>;
}

export interface ProductTrends {
  range: { from: string; to: string };
  bucket: AnalyticsBucket;
  buckets: ProductTrendBucket[];
}

export interface InventoryForecastItem {
  name: string;
  sku: string;
  currentStock: number;
  reorderLevel: number;
  avgDailyDemand: number;
  forecastDemand: number;
  recommendedReorder: number;
  unitPrice: number;
  status: 'healthy' | 'warning' | 'critical';
}

export interface InventoryForecast {
  range: { from: string; to: string };
  horizonDays: number;
  items: InventoryForecastItem[];
  projectedRevenue: number;
  projectedCogs: number;
}

export function createAnalyticsApi(client: ApiClient = apiClient) {
  return {
    summary: (from: string, to: string) =>
      client.get<AnalyticsSummary>(`/analytics/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
    salesTimeline: (from: string, to: string, bucket: AnalyticsBucket) =>
      client.get<SalesTimeline>(`/analytics/sales-timeline?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&bucket=${bucket}`),
    productTrends: (from: string, to: string, bucket: AnalyticsBucket) =>
      client.get<ProductTrends>(`/analytics/product-trends?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&bucket=${bucket}`),
    inventoryForecast: (from: string, to: string, horizonDays: number) =>
      client.get<InventoryForecast>(`/analytics/inventory-forecast?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&horizonDays=${horizonDays}`),
  };
}

export const analyticsApi = createAnalyticsApi();
