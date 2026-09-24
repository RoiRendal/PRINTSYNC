import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  OrderConflictDetails,
  OrdersSummary,
  OrderStatusCount,
  PaginationParams,
  PaginatedResponse,
} from '@printsync/shared-types';
import { AppError } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';
import { calculateRange, createPaginatedResponse } from '../../shared/pagination.js';
import { getShopTimeZone, toShopDateKey } from '../../shared/shopClock.js';
import { auditRpcArguments } from '../../shared/requestContext.js';
import { ORDER_STATUSES } from './orderStatuses.js';

/**
 * The structured context the RPC attaches when a save loses a race with another
 * editor. Lives in `@printsync/shared-types` so the API that raises it and the UI
 * that explains it share one definition; re-exported to keep this module's own
 * surface unchanged.
 */
export type { OrderConflictDetails };

// `OrderStatus` is the contract's, not this module's: it was declared a second time
// here, and a second declaration is a second copy to drift. It comes from
// `./orderStatuses` — the module that owns the runtime list and proves the list and
// the contract are the same set — so the type the service returns and the values the
// route validates against cannot disagree.
import type { OrderStatus } from './orderStatuses.js';
export type { OrderStatus };

// Re-exported for the same reason: the Workspace summary is a published shape, and
// `backend/tests/unit/contract.test.ts` can only assert the service agrees with the
// contract if the service's own surface names the type it returns.
export type { OrdersSummary, OrderStatusCount };

export interface OrderLineItem {
  itemId?: string | undefined;
  name: string;
  quantity: number;
  designId?: string | undefined;
  unitPrice: number;
}

export interface OrderRecord {
  id: string;
  customer: string;
  customerId?: string | undefined;
  dueDate?: string | undefined;
  item: string;
  lineItems: OrderLineItem[];
  quantity: number;
  status: OrderStatus;
  date: string;
  /**
   * The row's `updated_at`, handed to the client so its next save can name the
   * version it was working from. Passed back verbatim — it is a version token,
   * not a date to be parsed and re-formatted, and rounding it to milliseconds
   * would make every save look like a conflict.
   */
  updatedAt: string;
  amount: number;
  totalPaid: number;
  balanceDue: number;
  designId?: string | undefined;
  notes: string;
  isCustom: boolean;
}

export interface OrderInput {
  customer: string;
  lineItems: OrderLineItem[];
  amount: number;
  status?: OrderStatus | undefined;
  notes?: string | undefined;
  isCustom?: boolean | undefined;
  customerId?: string | undefined;
  dueDate?: string | undefined;
}

export interface OrderUpdateInput {
  customer?: string | undefined;
  lineItems?: OrderLineItem[] | undefined;
  amount?: number | undefined;
  status?: OrderStatus | undefined;
  notes?: string | undefined;
  isCustom?: boolean | undefined;
  customerId?: string | undefined;
  dueDate?: string | undefined;
}

const orderSelect = 'id, customer, customer_id, due_date, status, amount, notes, is_custom, created_at, updated_at';

function toRecord(
  row: Record<string, unknown>,
  items: OrderLineItem[],
  totalPaid: number,
  timeZone: string,
): OrderRecord {
  return {
    id: String(row.id),
    customer: String(row.customer),
    customerId: row.customer_id ? String(row.customer_id) : undefined,
    dueDate: row.due_date ? String(row.due_date) : undefined,
    item: items.map((item) => item.name).join(', '),
    lineItems: items,
    quantity: items.reduce((total, item) => total + item.quantity, 0),
    status: String(row.status) as OrderStatus,
    // The shop's calendar day, not the UTC one. Slicing the UTC ISO string put
    // every order taken before 08:00 local on the previous day.
    date: toShopDateKey(String(row.created_at), timeZone),
    updatedAt: String(row.updated_at),
    amount: Number(row.amount),
    totalPaid,
    balanceDue: Math.max(0, Number(row.amount) - totalPaid),
    designId: items.find((item) => item.designId)?.designId,
    notes: String(row.notes ?? ''),
    isCustom: Boolean(row.is_custom),
  };
}

async function loadItems(supabase: SupabaseClient, orderIds: string[]): Promise<Map<string, OrderLineItem[]>> {
  const result = new Map<string, OrderLineItem[]>();
  if (orderIds.length === 0) return result;
  const { data, error } = await supabase
    .from('order_items')
    .select('order_id, inventory_item_id, design_id, name, quantity, unit_price')
    .in('order_id', orderIds)
    .order('id');
  if (error) throw new AppError(503, 'ORDER_ITEMS_LOOKUP_FAILED', 'Order items could not be loaded.');
  for (const row of data) {
    const items = result.get(String(row.order_id)) ?? [];
    items.push({
      itemId: row.inventory_item_id ? String(row.inventory_item_id) : undefined,
      designId: row.design_id ? String(row.design_id) : undefined,
      name: String(row.name),
      quantity: Number(row.quantity),
      unitPrice: Number(row.unit_price),
    });
    result.set(String(row.order_id), items);
  }
  return result;
}

async function loadPayments(supabase: SupabaseClient, orderIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (orderIds.length === 0) return result;
  const { data, error } = await supabase
    .from('order_payments')
    .select('order_id, amount')
    .in('order_id', orderIds);
  if (error) throw new AppError(503, 'ORDER_PAYMENTS_LOOKUP_FAILED', 'Order payments could not be loaded.');
  for (const row of data) {
    const orderId = String(row.order_id);
    result.set(orderId, (result.get(orderId) ?? 0) + Number(row.amount));
  }
  return result;
}

/**
 * The one place rows become `OrderRecord`s, so the shop's time zone is resolved
 * once per call rather than threaded through every caller. `getShopTimeZone` is
 * cached, so this is not a settings query per order.
 */
async function mapOrders(supabase: SupabaseClient, rows: Record<string, unknown>[]): Promise<OrderRecord[]> {
  const ids = rows.map((row) => String(row.id));
  const [itemMap, paymentMap, timeZone] = await Promise.all([
    loadItems(supabase, ids),
    loadPayments(supabase, ids),
    getShopTimeZone(supabase),
  ]);
  return rows.map((row) =>
    toRecord(row, itemMap.get(String(row.id)) ?? [], paymentMap.get(String(row.id)) ?? 0, timeZone),
  );
}

/**
 * The Workspace's counts: how much work is waiting, over the whole table.
 *
 * This replaces a computation the Dashboard used to do in the browser from page 1
 * of a 20-row list, which is why "Active Orders" under-reported and why the
 * headline number disagreed with the table printed directly beneath it.
 *
 * **It fails loudly, and there is deliberately no fallback.** `analytics.service.ts`
 * carries the long version of why: a fallback there re-aggregated the same numbers
 * from four table reads, so a function that had raised on every call for months was
 * indistinguishable from a working one at every vantage point a person has. The two
 * paths also disagreed, so which figure you saw depended on whether an error nobody
 * was told about had happened. For a count an operator uses to decide what to do
 * next, a number quietly produced by a second implementation is worse than no
 * number. So: 503, the RPC's own message in the log, one source of truth.
 *
 * The current in-browser aggregation is not kept as a fallback. It is deleted in
 * the phase that rebuilds the page — that is part of the work, not a cleanup.
 */
export async function getOrdersSummary(supabase: SupabaseClient): Promise<OrdersSummary> {
  const { data, error } = await supabase.rpc('get_orders_summary');

  if (error || !data) {
    logger.error('Orders summary RPC failed', { error: error?.message });
    throw new AppError(503, 'ORDERS_SUMMARY_FAILED', 'Order counts could not be generated.');
  }

  const raw = data as {
    total: number;
    open: number;
    byStatus: Array<{ status: string; count: number }> | null;
    lowStock: number;
  };

  /*
   * Zero-fill against the contract's list rather than trusting the payload's.
   *
   * The database already zero-fills, and `orders.status` is constrained to these
   * six, so this looks redundant. It is the contract boundary: `OrdersSummary`
   * promises every status appears, and a card whose status is missing from the
   * array does not render a zero — it disappears from the page. That is a silent
   * failure the type system cannot catch, because a shorter array is still a valid
   * `OrderStatusCount[]`.
   *
   * Statuses the payload carries that are not in the contract are appended rather
   * than dropped, so `total` keeps equalling the sum of `byStatus` even if that
   * constraint is ever relaxed.
   */
  const counted = new Map((raw.byStatus ?? []).map((row) => [String(row.status), Number(row.count)]));
  const byStatus: OrderStatusCount[] = ORDER_STATUSES.map((status) => ({
    status,
    count: counted.get(status) ?? 0,
  }));
  for (const [status, count] of counted) {
    if (!ORDER_STATUSES.includes(status as OrderStatus)) byStatus.push({ status: status as OrderStatus, count });
  }

  return {
    total: Number(raw.total),
    open: Number(raw.open),
    byStatus,
    lowStock: Number(raw.lowStock),
  };
}

export async function listOrders(
  supabase: SupabaseClient,
  params: PaginationParams,
): Promise<PaginatedResponse<OrderRecord>> {
  const { start, end } = calculateRange(params.page, params.limit);
  const { data, error, count } = await supabase
    .from('orders')
    .select(orderSelect, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(start, end);
  if (error) throw new AppError(503, 'ORDERS_LOOKUP_FAILED', 'Orders could not be loaded.');
  const orders = await mapOrders(supabase, data);
  return createPaginatedResponse(orders, count ?? 0, params.page, params.limit);
}

export async function getOrder(supabase: SupabaseClient, id: string): Promise<OrderRecord> {
  const { data, error } = await supabase.from('orders').select(orderSelect).eq('id', id).maybeSingle();
  if (error || !data) throw new AppError(404, 'ORDER_NOT_FOUND', 'The order was not found.');
  const [order] = await mapOrders(supabase, [data]);
  return order as OrderRecord;
}

export async function createOrder(supabase: SupabaseClient, input: OrderInput, actorId: string): Promise<OrderRecord> {
  const { data, error } = await supabase.rpc('create_order_with_items', {
    p_customer: input.customer,
    p_status: input.status ?? 'Pending',
    p_amount: input.amount,
    p_notes: input.notes ?? '',
    p_is_custom: input.isCustom ?? false,
    p_created_by: actorId,
    p_items: input.lineItems,
    p_customer_id: input.customerId ?? null,
    p_due_date: input.dueDate ?? null,
    // The RPC writes the `order.created` audit row itself, inside its own
    // transaction, so the row cannot be lost while the order survives.
    ...auditRpcArguments(),
  });
  if (error || !data) throw new AppError(400, 'ORDER_CREATE_FAILED', error?.message ?? 'The order could not be created.');
  return getOrder(supabase, String((data as Record<string, unknown>).id));
}

function isOrderConflictDetails(value: unknown): value is OrderConflictDetails {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.orderId === 'string' &&
    typeof candidate.expectedUpdatedAt === 'string' &&
    typeof candidate.currentUpdatedAt === 'string'
  );
}

/**
 * Turns an RPC failure into the right HTTP outcome.
 *
 * A lost race is not a bad request — the payload was well formed and would have
 * succeeded a moment earlier — so it is a 409, and it carries the version the
 * caller was working from so the UI can say what happened.
 */
function mapUpdateFailure(error: { message?: string; details?: string | null } | null): AppError {
  const message = error?.message ?? 'The order could not be updated.';

  if (typeof error?.details === 'string' && error.details.length > 0) {
    try {
      const parsed: unknown = JSON.parse(error.details);
      if (isOrderConflictDetails(parsed)) {
        return new AppError(409, 'ORDER_CONFLICT', message, parsed);
      }
    } catch {
      // `details` is not always ours — Postgres also puts constraint names there.
      // A parse failure simply means "no structured context".
    }
  }

  return new AppError(400, 'ORDER_UPDATE_FAILED', message);
}

/**
 * @param expectedUpdatedAt the `updatedAt` the editor loaded. The write is refused
 *   if the order has moved on since, so two staff editing the same order cannot
 *   silently overwrite each other — the second save fails loudly instead.
 */
export async function updateOrder(
  supabase: SupabaseClient,
  id: string,
  input: OrderUpdateInput,
  actorId: string,
  expectedUpdatedAt: string,
): Promise<OrderRecord> {
  if (input.lineItems !== undefined) {
    const existing = await getOrder(supabase, id);
    const { data, error } = await supabase.rpc('replace_order_with_items', {
      p_order_id: id,
      p_customer: input.customer ?? existing.customer,
      p_status: input.status ?? existing.status,
      p_amount: input.amount ?? existing.amount,
      p_notes: input.notes ?? existing.notes,
      p_is_custom: input.isCustom ?? existing.isCustom,
      p_items: input.lineItems,
      p_actor_id: actorId,
      p_customer_id: input.customerId ?? existing.customerId ?? null,
      p_due_date: input.dueDate ?? existing.dueDate ?? null,
      p_expected_updated_at: expectedUpdatedAt,
      // `order.updated` is audited here, inside the transaction. The status-only
      // path below has no RPC, so it still audits from the route — see
      // `orders.routes.ts`, which has to tell the two apart.
      ...auditRpcArguments(),
    });
    if (error || !data) throw mapUpdateFailure(error);
    return getOrder(supabase, id);
  }

  const updates: Record<string, unknown> = {};
  if (input.customer !== undefined) updates.customer = input.customer;
  if (input.status !== undefined) updates.status = input.status;
  if (input.amount !== undefined) updates.amount = input.amount;
  if (input.notes !== undefined) updates.notes = input.notes;
  if (input.isCustom !== undefined) updates.is_custom = input.isCustom;
  if (input.customerId !== undefined) updates.customer_id = input.customerId ?? null;
  if (input.dueDate !== undefined) updates.due_date = input.dueDate ?? null;

  /*
   * A compare-and-swap rather than a plain update: carrying the loaded version in
   * the filter means the statement matches no row at all if someone else got
   * there first. This path has no RPC to lock inside, so the WHERE clause is what
   * makes it atomic.
   */
  const { data, error } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', id)
    .eq('updated_at', expectedUpdatedAt)
    .select(orderSelect)
    .maybeSingle();
  if (error) throw new AppError(400, 'ORDER_UPDATE_FAILED', error.message);

  if (!data) {
    // Nothing matched. Ask why, so a lost race reads as a conflict rather than a
    // bare "not found" that would send the user hunting for a deleted order.
    const current = await supabase.from('orders').select('id, updated_at').eq('id', id).maybeSingle();
    if (!current.data) throw new AppError(404, 'ORDER_NOT_FOUND', 'The order was not found.');
    throw new AppError(
      409,
      'ORDER_CONFLICT',
      'This order was changed by someone else while you were editing it.',
      {
        orderId: id,
        expectedUpdatedAt,
        currentUpdatedAt: String(current.data.updated_at),
      } satisfies OrderConflictDetails,
    );
  }

  return getOrder(supabase, String(data.id));
}

export async function deleteOrder(supabase: SupabaseClient, id: string, actorId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_order_with_items', {
    p_order_id: id,
    p_actor_id: actorId,
    // This is the one that matters most. After it returns the order row is gone,
    // and the audit row is the only remaining evidence that it existed.
    ...auditRpcArguments(),
  });
  if (error) throw new AppError(404, 'ORDER_DELETE_FAILED', error.message || 'The order could not be deleted.');
}

export async function exportOrders(supabase: SupabaseClient): Promise<OrderRecord[]> {
  const { data, error } = await supabase.from('orders').select(orderSelect).order('created_at', { ascending: false });
  if (error) throw new AppError(503, 'ORDERS_LOOKUP_FAILED', 'Orders could not be loaded.');
  return mapOrders(supabase, data);
}