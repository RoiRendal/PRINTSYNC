import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../shared/errors.js';

export interface AnalyticsRange {
  from: string;
  to: string;
}

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