import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';

export interface AnalyticsRange {
  from: string;
  to: string;
}

export type AnalyticsBucket = 'day' | 'week' | 'quarter';

export interface AnalyticsSummary {
  range: AnalyticsRange;
  revenue: number;
  transactionCount: number;
  orderCount: number;
  averageTransactionValue: number;
  salesByDay: Array<{ date: string; revenue: number; transactions: number }>;
  ordersByStatus: Array<{ status: string; count: number }>;
  topItems: Array<{ name: string; quantity: number; revenue: number }>;
  inventoryAlerts: number;
}

export interface SalesTimelineBucket {
  label: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  margin: number;
  transactionCount: number;
}

export interface SalesTimeline {
  range: AnalyticsRange;
  bucket: AnalyticsBucket;
  buckets: SalesTimelineBucket[];
}

export interface ProductTrendBucket {
  label: string;
  items: Array<{ name: string; quantity: number }>;
}

export interface ProductTrends {
  range: AnalyticsRange;
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
  range: AnalyticsRange;
  horizonDays: number;
  items: InventoryForecastItem[];
  projectedRevenue: number;
  projectedCogs: number;
}

interface TransactionRow {
  total: number;
  created_at: string;
}

interface TransactionItemRow {
  name: string;
  quantity: number;
  unit_price: number;
  transaction: { total: number; created_at: string } | null;
}

interface ForecastItemRow {
  inventory_item_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  transaction: { created_at: string } | null;
}

interface InventoryItemRow {
  id: string;
  name: string;
  sku: string;
  stock: number;
  reorder_level: number;
  price: number;
}

function toDateKey(value: string): string {
  return value.slice(0, 10);
}

function normalizeRange(range: AnalyticsRange): AnalyticsRange {
  const from = new Date(`${range.from}T00:00:00.000Z`);
  const to = new Date(`${range.to}T23:59:59.999Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    throw new AppError(400, 'INVALID_ANALYTICS_RANGE', 'The analytics date range is invalid.');
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

export async function getAnalyticsSummary(supabase: SupabaseClient, range: AnalyticsRange): Promise<AnalyticsSummary> {
  const normalizedRange = normalizeRange(range);

  const { data: rpcData, error: rpcError } = await supabase
    .rpc('get_analytics_summary', {
      p_from: normalizedRange.from,
      p_to: normalizedRange.to,
    });

  if (rpcError || !rpcData) {
    logger.warn('Analytics summary RPC failed, falling back to client-side aggregation', {
      error: rpcError?.message,
    });

    // Fallback to client-side aggregation if RPC is not available
    const [transactionsResult, orderResult, itemsResult, inventoryResult] = await Promise.all([
      supabase
        .from('sales_transactions')
        .select('total, created_at')
        .eq('status', 'completed')
        .gte('created_at', normalizedRange.from)
        .lte('created_at', normalizedRange.to),
      supabase
        .from('orders')
        .select('status')
        .gte('created_at', normalizedRange.from)
        .lte('created_at', normalizedRange.to),
      supabase
        .from('sales_transaction_items')
        .select('name, quantity, unit_price, transaction:sales_transactions!inner(total, created_at)')
        .eq('transaction.status', 'completed')
        .gte('transaction.created_at', normalizedRange.from)
        .lte('transaction.created_at', normalizedRange.to),
      supabase
        .from('inventory_items')
        .select('stock, reorder_level'),
    ]);

    if (transactionsResult.error || orderResult.error || itemsResult.error || inventoryResult.error) {
      throw new AppError(503, 'ANALYTICS_LOOKUP_FAILED', 'Analytics could not be generated.');
    }

    const transactions = transactionsResult.data as TransactionRow[];
    const daily = new Map<string, { revenue: number; transactions: number }>();
    for (const transaction of transactions) {
      const date = toDateKey(transaction.created_at);
      const current = daily.get(date) ?? { revenue: 0, transactions: 0 };
      current.revenue += Number(transaction.total);
      current.transactions += 1;
      daily.set(date, current);
    }

    const statusCounts = new Map<string, number>();
    for (const order of orderResult.data) {
      const status = String(order.status);
      statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
    }

    const itemTotals = new Map<string, { quantity: number; revenue: number }>();
    for (const item of itemsResult.data as unknown as TransactionItemRow[]) {
      const current = itemTotals.get(item.name) ?? { quantity: 0, revenue: 0 };
      current.quantity += Number(item.quantity);
      current.revenue += Number(item.quantity) * Number(item.unit_price);
      itemTotals.set(item.name, current);
    }

    const revenue = transactions.reduce((total, transaction) => total + Number(transaction.total), 0);
    return {
      range,
      revenue,
      transactionCount: transactions.length,
      orderCount: orderResult.data.length,
      averageTransactionValue: transactions.length === 0 ? 0 : revenue / transactions.length,
      salesByDay: [...daily.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([date, values]) => ({ date, ...values })),
      ordersByStatus: [...statusCounts.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([status, count]) => ({ status, count })),
      topItems: [...itemTotals.entries()]
        .sort(([, left], [, right]) => right.revenue - left.revenue)
        .slice(0, 10)
        .map(([name, values]) => ({ name, ...values })),
      inventoryAlerts: inventoryResult.data.filter((item) => Number(item.stock) <= Number(item.reorder_level)).length,
    };
  }

  const summary = rpcData as {
    revenue: number;
    transactionCount: number;
    orderCount: number;
    salesByDay: Array<{ date: string; revenue: number; transactions: number }>;
    ordersByStatus: Array<{ status: string; count: number }>;
    topItems: Array<{ name: string; quantity: number; revenue: number }>;
    inventoryAlerts: number;
  };

  const revenue = Number(summary.revenue);
  const transactionCount = Number(summary.transactionCount);

  return {
    range,
    revenue,
    transactionCount,
    orderCount: Number(summary.orderCount),
    averageTransactionValue: transactionCount === 0 ? 0 : revenue / transactionCount,
    salesByDay: summary.salesByDay ?? [],
    ordersByStatus: summary.ordersByStatus ?? [],
    topItems: summary.topItems ?? [],
    inventoryAlerts: Number(summary.inventoryAlerts),
  };
}

/* ---------------------------------------------------------------------------
 * Feature 1 — Historical POS Data (Descriptive Analytics)
 *
 * Buckets completed sales transactions by day/week/quarter and computes
 * revenue, COGS (sum of quantity * unit_price from transaction items), gross
 * profit, and margin for each bucket.
 * ------------------------------------------------------------------------ */

function bucketLabel(date: Date, bucket: AnalyticsBucket): string {
  if (bucket === 'day') {
    return date.toISOString().slice(0, 10);
  }
  if (bucket === 'week') {
    const year = date.getUTCFullYear();
    const weekOfYear = isoWeek(date);
    return `${year} W${String(weekOfYear).padStart(2, '0')}`;
  }
  // quarter
  const year = date.getUTCFullYear();
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  return `${year} Q${quarter}`;
}

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

function bucketKey(date: Date, bucket: AnalyticsBucket): string {
  if (bucket === 'day') {
    return date.toISOString().slice(0, 10);
  }
  if (bucket === 'week') {
    return bucketLabel(date, 'week');
  }
  return bucketLabel(date, 'quarter');
}

export async function getSalesTimeline(
  supabase: SupabaseClient,
  range: AnalyticsRange,
  bucket: AnalyticsBucket,
): Promise<SalesTimeline> {
  const normalizedRange = normalizeRange(range);
  const [transactionsResult, itemsResult] = await Promise.all([
    supabase
      .from('sales_transactions')
      .select('total, created_at')
      .eq('status', 'completed')
      .gte('created_at', normalizedRange.from)
      .lte('created_at', normalizedRange.to)
      .order('created_at', { ascending: true }),
    supabase
      .from('sales_transaction_items')
      .select('name, quantity, unit_price, transaction:sales_transactions!inner(total, created_at)')
      .eq('transaction.status', 'completed')
      .gte('transaction.created_at', normalizedRange.from)
      .lte('transaction.created_at', normalizedRange.to),
  ]);

  if (transactionsResult.error || itemsResult.error) {
    throw new AppError(503, 'ANALYTICS_LOOKUP_FAILED', 'Sales timeline could not be generated.');
  }

  const transactions = transactionsResult.data as TransactionRow[];
  const items = itemsResult.data as unknown as TransactionItemRow[];

  const revenueByBucket = new Map<string, { revenue: number; transactionCount: number; firstDate: Date }>();
  for (const txn of transactions) {
    const date = new Date(txn.created_at);
    const key = bucketKey(date, bucket);
    const current = revenueByBucket.get(key) ?? { revenue: 0, transactionCount: 0, firstDate: date };
    current.revenue += Number(txn.total);
    current.transactionCount += 1;
    if (date < current.firstDate) current.firstDate = date;
    revenueByBucket.set(key, current);
  }

  const cogsByBucket = new Map<string, number>();
  for (const item of items) {
    if (!item.transaction) continue;
    const date = new Date(item.transaction.created_at);
    const key = bucketKey(date, bucket);
    cogsByBucket.set(key, (cogsByBucket.get(key) ?? 0) + Number(item.quantity) * Number(item.unit_price));
  }

  const sortedKeys = [...revenueByBucket.keys()].sort((a, b) => {
    const dateA = revenueByBucket.get(a)!.firstDate;
    const dateB = revenueByBucket.get(b)!.firstDate;
    return dateA.getTime() - dateB.getTime();
  });

  const buckets: SalesTimelineBucket[] = sortedKeys.map((key) => {
    const entry = revenueByBucket.get(key)!;
    const cogs = cogsByBucket.get(key) ?? 0;
    const grossProfit = entry.revenue - cogs;
    const margin = entry.revenue === 0 ? 0 : (grossProfit / entry.revenue) * 100;
    return {
      label: bucketLabel(entry.firstDate, bucket),
      revenue: Math.round(entry.revenue * 100) / 100,
      cogs: Math.round(cogs * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      margin: Math.round(margin * 100) / 100,
      transactionCount: entry.transactionCount,
    };
  });

  return { range, bucket, buckets };
}

/* ---------------------------------------------------------------------------
 * Feature 2 — Product Demand Trend Identification
 *
 * Joins sales_transaction_items to sales_transactions, groups by product name
 * and time bucket, returns per-bucket per-product quantities.
 * ------------------------------------------------------------------------ */

export async function getProductTrends(
  supabase: SupabaseClient,
  range: AnalyticsRange,
  bucket: AnalyticsBucket,
): Promise<ProductTrends> {
  const normalizedRange = normalizeRange(range);
  const itemsResult = await supabase
    .from('sales_transaction_items')
    .select('name, quantity, transaction:sales_transactions!inner(total, created_at)')
    .eq('transaction.status', 'completed')
    .gte('transaction.created_at', normalizedRange.from)
    .lte('transaction.created_at', normalizedRange.to);

  if (itemsResult.error) {
    throw new AppError(503, 'ANALYTICS_LOOKUP_FAILED', 'Product trends could not be generated.');
  }

  const items = itemsResult.data as unknown as TransactionItemRow[];

  const bucketMap = new Map<string, { firstDate: Date; items: Map<string, number> }>();

  for (const item of items) {
    if (!item.transaction) continue;
    const date = new Date(item.transaction.created_at);
    const key = bucketKey(date, bucket);
    let entry = bucketMap.get(key);
    if (!entry) {
      entry = { firstDate: date, items: new Map() };
      bucketMap.set(key, entry);
    }
    if (date < entry.firstDate) entry.firstDate = date;
    entry.items.set(item.name, (entry.items.get(item.name) ?? 0) + Number(item.quantity));
  }

  const sortedKeys = [...bucketMap.keys()].sort((a, b) => {
    const dateA = bucketMap.get(a)!.firstDate;
    const dateB = bucketMap.get(b)!.firstDate;
    return dateA.getTime() - dateB.getTime();
  });

  const resultBuckets: ProductTrendBucket[] = sortedKeys.map((key) => {
    const entry = bucketMap.get(key)!;
    return {
      label: bucketLabel(entry.firstDate, bucket),
      items: [...entry.items.entries()]
        .map(([name, quantity]) => ({ name, quantity: Number(quantity) }))
        .sort((a, b) => b.quantity - a.quantity),
    };
  });

  return { range, bucket, buckets: resultBuckets };
}

/* ---------------------------------------------------------------------------
 * Feature 3 — Inventory Requirement Forecasting (Predictive Analytics)
 *
 * Computes average daily demand per inventory item from historical
 * transactions, projects future demand over a configurable horizon, and
 * recommends reorder quantities. Uses simple moving-average method.
 * ------------------------------------------------------------------------ */

export async function getInventoryForecast(
  supabase: SupabaseClient,
  range: AnalyticsRange,
  horizonDays: number,
): Promise<InventoryForecast> {
  const normalizedRange = normalizeRange(range);

  const from = new Date(normalizedRange.from);
  const to = new Date(normalizedRange.to);
  const rangeSpanDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000));

  const [itemsResult, inventoryResult] = await Promise.all([
    supabase
      .from('sales_transaction_items')
      .select('inventory_item_id, name, quantity, unit_price, transaction:sales_transactions!inner(created_at)')
      .eq('transaction.status', 'completed')
      .gte('transaction.created_at', normalizedRange.from)
      .lte('transaction.created_at', normalizedRange.to),
    supabase
      .from('inventory_items')
      .select('id, name, sku, stock, reorder_level, price'),
  ]);

  if (itemsResult.error || inventoryResult.error) {
    throw new AppError(503, 'ANALYTICS_LOOKUP_FAILED', 'Inventory forecast could not be generated.');
  }

  const items = itemsResult.data as unknown as ForecastItemRow[];
  const inventoryItems = inventoryResult.data as InventoryItemRow[];

  // Aggregate total quantity sold per inventory_item_id
  const demandByItemId = new Map<string, { totalQuantity: number; name: string; unitPrice: number }>();
  for (const item of items) {
    if (!item.inventory_item_id) continue;
    const existing = demandByItemId.get(item.inventory_item_id);
    if (existing) {
      existing.totalQuantity += Number(item.quantity);
    } else {
      demandByItemId.set(item.inventory_item_id, {
        totalQuantity: Number(item.quantity),
        name: item.name,
        unitPrice: Number(item.unit_price),
      });
    }
  }

  let projectedRevenue = 0;
  let projectedCogs = 0;

  const forecastItems: InventoryForecastItem[] = inventoryItems.map((inv) => {
    const demand = demandByItemId.get(inv.id);
    const avgDailyDemand = demand ? demand.totalQuantity / rangeSpanDays : 0;
    const forecastDemand = Math.round(avgDailyDemand * horizonDays);
    const currentStock = Number(inv.stock);
    const reorderLevel = Number(inv.reorder_level);
    const unitPrice = Number(inv.price);

    const recommendedReorder = Math.max(0, reorderLevel + forecastDemand - currentStock);

    let status: InventoryForecastItem['status'] = 'healthy';
    if (currentStock <= reorderLevel) {
      status = 'critical';
    } else if (currentStock <= forecastDemand) {
      status = 'warning';
    }

    projectedRevenue += forecastDemand * unitPrice;
    projectedCogs += demand ? forecastDemand * demand.unitPrice : 0;

    return {
      name: inv.name,
      sku: inv.sku,
      currentStock,
      reorderLevel,
      avgDailyDemand: Math.round(avgDailyDemand * 100) / 100,
      forecastDemand,
      recommendedReorder,
      unitPrice,
      status,
    };
  });

  // Sort by status priority (critical first), then by recommended reorder descending
  const statusOrder = { critical: 0, warning: 1, healthy: 2 };
  forecastItems.sort((a, b) => {
    if (statusOrder[a.status] !== statusOrder[b.status]) {
      return statusOrder[a.status] - statusOrder[b.status];
    }
    return b.recommendedReorder - a.recommendedReorder;
  });

  return {
    range,
    horizonDays,
    items: forecastItems,
    projectedRevenue: Math.round(projectedRevenue * 100) / 100,
    projectedCogs: Math.round(projectedCogs * 100) / 100,
  };
}