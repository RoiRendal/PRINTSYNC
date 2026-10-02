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

export interface BranchComparisonBranch {
  branchId: string;
  code: string;
  name: string;
  revenue: number;
  transactionCount: number;
  orderCount: number;
  averageTransactionValue: number;
  salesByDay: Array<{ date: string; revenue: number; transactions: number }>;
  topItems: Array<{ name: string; quantity: number; revenue: number }>;
}

export interface BranchComparison {
  range: { from: string; to: string };
  branches: BranchComparisonBranch[];
  combined: {
    revenue: number;
    transactionCount: number;
    orderCount: number;
    averageTransactionValue: number;
    salesByDay: Array<{ date: string; revenue: number; transactions: number }>;
    topItems: Array<{ name: string; quantity: number; revenue: number }>;
  };
}

/**
 * The branch a request is *about*. `undefined` means "the caller's own branch" —
 * the server decides, and for staff that is the only thing it will ever return.
 * `'all'` is the head-office combined view. A specific branch id is honoured only
 * for an account the server recognises as head office; anyone else gets a 403.
 *
 * The client cannot decide this. It asks; the server answers or refuses.
 */
export type BranchScope = string | undefined;

/** Appends `&branch=` only when a scope was actually chosen. */
function branchParam(scope: BranchScope): string {
  return scope ? `&branch=${encodeURIComponent(scope)}` : '';
}

export function createAnalyticsApi(client: ApiClient = apiClient) {
  return {
    summary: (from: string, to: string, branch: BranchScope = undefined) =>
      client.get<AnalyticsSummary>(`/analytics/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${branchParam(branch)}`),
    salesTimeline: (from: string, to: string, bucket: AnalyticsBucket, branch: BranchScope = undefined) =>
      client.get<SalesTimeline>(`/analytics/sales-timeline?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&bucket=${bucket}${branchParam(branch)}`),
    productTrends: (from: string, to: string, bucket: AnalyticsBucket, branch: BranchScope = undefined) =>
      client.get<ProductTrends>(`/analytics/product-trends?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&bucket=${bucket}${branchParam(branch)}`),
    inventoryForecast: (from: string, to: string, horizonDays: number, branch: BranchScope = undefined) =>
      client.get<InventoryForecast>(`/analytics/inventory-forecast?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&horizonDays=${horizonDays}${branchParam(branch)}`),
    /**
     * The head-office band-by-band comparison. Not branch-parameterised on purpose:
     * the server reads the branch list itself, so the set being compared is not
     * something a request can widen.
     */
    branchComparison: (from: string, to: string) =>
      client.get<BranchComparison>(`/analytics/branch-comparison?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  };
}

export const analyticsApi = createAnalyticsApi();
