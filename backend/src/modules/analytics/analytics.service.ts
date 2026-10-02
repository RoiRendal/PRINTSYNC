import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';
import { getShopTimeZone, shopDateParts, shopDayEnd, shopDayStart } from '../../shared/shopClock.js';

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
  inventory_item_id: string | null;
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
  cost_price: number;
}

/**
 * Adds a branch predicate to a query, or leaves it alone for the combined view.
 *
 * A tiny helper with a large job: it is the difference between "this read is scoped
 * to a branch" and "this read aggregates everything". Writing the ternary at each
 * of the six call sites invites one of them to be written the other way round — and
 * a missing branch predicate on an analytics query does not throw, it just returns
 * a bigger number. Keeping it in one function means the check has one place to be
 * wrong, and that place is tested.
 *
 * `column` is a parameter because `sales_transaction_items` has no `branch_id` of
 * its own and is scoped through its embedded parent (`transaction.branch_id`).
 *
 * ### Why the parameter is typed as a bare `.eq()` shape, not the builder
 *
 * The obvious signature is `<T extends { eq(...): T }>(query: T): T`. It does not
 * compile: PostgREST's query builder is a recursively nested generic, and asking
 * TypeScript to prove it satisfies a self-referential constraint makes it give up
 * with `TS2589: Type instantiation is excessively deep and possibly infinite`.
 *
 * The signature below retains the caller's concrete type with `query: T` (no
 * constraint) and reads `.eq` through a narrow cast *inside* the function, so the
 * call site keeps the builder's real type — including its `PromiseLike` surface,
 * which is what `await` needs — while the type-checker is never asked to relate the
 * two. The cast is confined to one expression and is honest: `.eq()` returns the
 * same builder in every PostgREST overload.
 */
interface BranchFilterable {
  eq(column: string, value: string): unknown;
}

function applyBranch<T>(query: T, branchId: string | null | undefined, column = 'branch_id'): T {
  if (!branchId) return query;
  return (query as unknown as BranchFilterable).eq(column, branchId) as T;
}

/**
 * Widens `YYYY-MM-DD` endpoints to whole days **in the shop's zone**.
 *
 * Previously the boundaries were UTC (`T00:00:00.000Z` / `T23:59:59.999Z`). For a
 * UTC+8 shop that is an eight-hour error at each end: the range
 * `2026-09-01..2026-09-30` started eight hours into the 1st and ended eight hours
 * before the end of the 30th, so a morning sale on the 1st fell outside the window
 * entirely and a late-evening sale on the 30th was counted a day early.
 */
function normalizeRange(range: AnalyticsRange, timeZone: string): AnalyticsRange {
  const from = shopDayStart(range.from, timeZone);
  const to = shopDayEnd(range.to, timeZone);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    throw new AppError(400, 'INVALID_ANALYTICS_RANGE', 'The analytics date range is invalid.');
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

/**
 * `branchId` is now the effective branch, resolved by
 * `resolveAnalyticsBranchFilter` — the caller's own branch for staff, an explicitly
 * chosen one (or `null`, meaning "all branches") for a head-office account.
 *
 * `null` therefore reaches this function only from a head-office combined view,
 * never from a staff request: the resolver refuses that combination with a 403
 * before the call is made. The RPC reads `null` as "no branch predicate", which is
 * the whole point of the nullable parameter (see
 * `20261002000600_analytics_summary_branch.sql`).
 *
 * The **same** `branchId` drives the time zone. It has to: the range is widened to
 * whole days in that zone before the RPC sees it, and the RPC buckets `salesByDay`
 * in the same zone. Two different branches in two zones would each expand their own
 * range correctly; the combined view has no zone of its own, so `getShopTimeZone`
 * falls back to the oldest settings row (Balayan's), matching the RPC.
 */
export async function getAnalyticsSummary(
  supabase: SupabaseClient,
  range: AnalyticsRange,
  branchId?: string | null,
): Promise<AnalyticsSummary> {
  const timeZone = await getShopTimeZone(supabase, branchId ?? undefined);
  const normalizedRange = normalizeRange(range, timeZone);

  const { data: rpcData, error: rpcError } = await supabase
    .rpc('get_analytics_summary', {
      p_from: normalizedRange.from,
      p_to: normalizedRange.to,
      // Null means "every branch" — see the migration header. Sent explicitly so a
      // combined read and a branch read are the same call shape.
      p_branch_id: branchId ?? null,
    });

  /*
   * One implementation, or an error. There is deliberately no fallback here.
   *
   * There used to be one: on RPC failure the service re-aggregated the same
   * numbers from four table reads. It looked harmless, and it was the opposite.
   *
   * The deployed function raised `42803 aggregate function calls cannot be
   * nested`. The service logged a warning nobody read and the dashboard kept
   * drawing charts — from the fallback — so a broken function was
   * indistinguishable from a working one at every vantage point a person has.
   * That is how it survived long enough to be found by an audit rather than by
   * somebody using the system.
   *
   * The two paths could also disagree: they grouped days differently, computed
   * `topItems` differently, and read different columns. So which revenue figure
   * appeared depended on whether an error nobody was told about had happened.
   * For a money number that is worse than having no number at all — a figure
   * quietly produced by a second implementation is one nobody knows to distrust.
   *
   * So it fails loudly instead. The caller gets a 503, the operator gets the
   * function's own error message in the log, and these numbers come from exactly
   * one place.
   */
  if (rpcError || !rpcData) {
    logger.error('Analytics summary RPC failed', { error: rpcError?.message });
    throw new AppError(503, 'ANALYTICS_LOOKUP_FAILED', 'Analytics could not be generated.');
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

/**
 * The bucket an instant belongs to, in the shop's zone.
 *
 * This replaces a `bucketKey` / `bucketLabel` pair whose bodies were identical for
 * all three buckets — the day key and the day label were the same string, and the
 * other two just delegated. Two names for one answer is how they drift, so there
 * is one function now.
 *
 * The calendar parts come from the shop's zone rather than `getUTC*`. That matters
 * most for `day`: bucketing a 07:00 Manila sale under the previous UTC date split
 * one business morning across two points on the chart.
 */
function bucketKey(value: string | Date, bucket: AnalyticsBucket, timeZone: string): string {
  const { year, month, day } = shopDateParts(value, timeZone);
  const paddedYear = String(year).padStart(4, '0');

  if (bucket === 'day') {
    return `${paddedYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  if (bucket === 'week') {
    return `${paddedYear} W${String(isoWeek(year, month, day)).padStart(2, '0')}`;
  }
  return `${paddedYear} Q${Math.floor((month - 1) / 3) + 1}`;
}

/**
 * ISO-8601 week number for a calendar date.
 *
 * Takes the shop-local year/month/day rather than reading them off a `Date` with
 * `getUTC*`: the week a sale belongs to is a property of the local calendar date,
 * so the local date has to be the input. The arithmetic is the standard
 * "move to the Thursday of this week, then count from January 1".
 */
function isoWeek(year: number, month: number, day: number): number {
  const d = new Date(Date.UTC(year, month - 1, day));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

export async function getSalesTimeline(
  supabase: SupabaseClient,
  range: AnalyticsRange,
  bucket: AnalyticsBucket,
  branchId?: string | null,
): Promise<SalesTimeline> {
  const timeZone = await getShopTimeZone(supabase, branchId ?? undefined);
  const normalizedRange = normalizeRange(range, timeZone);
  const [transactionsResult, itemsResult, inventoryResult] = await Promise.all([
    /*
     * `.eq('branch_id', branchId)` only when a branch was chosen.
     *
     * `sales_transactions` carries its own `branch_id`; `sales_transaction_items`
     * does not (20261002000300_branch_scoping.sql) and is scoped through its joined
     * parent instead. The inventory cost map is branch-scoped too, or a Nasugbu
     * item's cost could be matched against a Balayan sale — the COGS would be wrong
     * with no visible symptom.
     *
     * For the combined view (`branchId === null`) no predicate is added at all,
     * which is exactly the "all branches" read. This is safe only because the
     * resolver has already refused `null` for anyone without `canViewAllBranches`.
     */
    applyBranch(
      supabase
        .from('sales_transactions')
        .select('total, created_at')
        .eq('status', 'completed')
        .gte('created_at', normalizedRange.from)
        .lte('created_at', normalizedRange.to)
        .order('created_at', { ascending: true }),
      branchId,
    ),
    applyBranch(
      supabase
        .from('sales_transaction_items')
        .select('name, quantity, unit_price, inventory_item_id, transaction:sales_transactions!inner(total, created_at)')
        .eq('transaction.status', 'completed')
        .gte('transaction.created_at', normalizedRange.from)
        .lte('transaction.created_at', normalizedRange.to),
      branchId,
      'transaction.branch_id',
    ),
    applyBranch(supabase.from('inventory_items').select('id, cost_price'), branchId),
  ]);

  if (transactionsResult.error || itemsResult.error || inventoryResult.error) {
    throw new AppError(503, 'ANALYTICS_LOOKUP_FAILED', 'Sales timeline could not be generated.');
  }

  const transactions = transactionsResult.data as TransactionRow[];
  const items = itemsResult.data as unknown as TransactionItemRow[];
  const costMap = new Map((inventoryResult.data as Array<{ id: string; cost_price: number }>).map((i) => [i.id, Number(i.cost_price)]));

  const revenueByBucket = new Map<string, { revenue: number; transactionCount: number; firstDate: Date }>();
  for (const txn of transactions) {
    const date = new Date(txn.created_at);
    const key = bucketKey(date, bucket, timeZone);
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
    const key = bucketKey(date, bucket, timeZone);
    const costPrice = item.inventory_item_id ? (costMap.get(item.inventory_item_id) ?? 0) : 0;
    cogsByBucket.set(key, (cogsByBucket.get(key) ?? 0) + Number(item.quantity) * costPrice);
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
      label: bucketKey(entry.firstDate, bucket, timeZone),
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
  branchId?: string | null,
): Promise<ProductTrends> {
  const timeZone = await getShopTimeZone(supabase, branchId ?? undefined);
  const normalizedRange = normalizeRange(range, timeZone);
  // Scoped through the joined parent — `sales_transaction_items` has no
  // `branch_id` of its own. See `getSalesTimeline` for the full reasoning.
  const itemsResult = await applyBranch(
    supabase
      .from('sales_transaction_items')
      .select('name, quantity, transaction:sales_transactions!inner(total, created_at)')
      .eq('transaction.status', 'completed')
      .gte('transaction.created_at', normalizedRange.from)
      .lte('transaction.created_at', normalizedRange.to),
    branchId,
    'transaction.branch_id',
  );

  if (itemsResult.error) {
    throw new AppError(503, 'ANALYTICS_LOOKUP_FAILED', 'Product trends could not be generated.');
  }

  const items = itemsResult.data as unknown as TransactionItemRow[];

  const bucketMap = new Map<string, { firstDate: Date; items: Map<string, number> }>();

  for (const item of items) {
    if (!item.transaction) continue;
    const date = new Date(item.transaction.created_at);
    const key = bucketKey(date, bucket, timeZone);
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
      label: bucketKey(entry.firstDate, bucket, timeZone),
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
  branchId?: string | null,
): Promise<InventoryForecast> {
  const timeZone = await getShopTimeZone(supabase, branchId ?? undefined);
  const normalizedRange = normalizeRange(range, timeZone);

  const from = new Date(normalizedRange.from);
  const to = new Date(normalizedRange.to);
  const rangeSpanDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000));

  const [itemsResult, inventoryResult] = await Promise.all([
    // Demand comes from the branch's own completed sales; stock on hand from the
    // branch's own inventory. Leaving either unscoped would forecast one shop's
    // demand against the other shop's stock — a recommendation that is wrong twice.
    applyBranch(
      supabase
        .from('sales_transaction_items')
        .select('inventory_item_id, name, quantity, unit_price, transaction:sales_transactions!inner(created_at)')
        .eq('transaction.status', 'completed')
        .gte('transaction.created_at', normalizedRange.from)
        .lte('transaction.created_at', normalizedRange.to),
      branchId,
      'transaction.branch_id',
    ),
    applyBranch(
      supabase.from('inventory_items').select('id, name, sku, stock, reorder_level, price, cost_price'),
      branchId,
    ),
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
    const costPrice = Number(inv.cost_price ?? 0);

    const recommendedReorder = Math.max(0, reorderLevel + forecastDemand - currentStock);

    let status: InventoryForecastItem['status'] = 'healthy';
    if (currentStock <= reorderLevel) {
      status = 'critical';
    } else if (currentStock <= forecastDemand) {
      status = 'warning';
    }

    projectedRevenue += forecastDemand * unitPrice;
    projectedCogs += forecastDemand * costPrice;

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