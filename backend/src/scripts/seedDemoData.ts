/**
 * Seeds PrintSync with a coherent four-month demo dataset.
 *
 * Run with:  npm run seed:demo   (from the backend workspace)
 * Options:   --snapshot-only   back up the current database and stop
 *            --no-snapshot     skip the pre-wipe backup
 *            --no-uploads      reuse existing artwork instead of uploading
 *            --verify-only     print a coverage report for the current data
 *
 * The script never touches auth users, profiles, roles, permissions or
 * role_permissions. It writes business data through the same Postgres
 * functions the API calls, so stock, payments and totals always reconcile.
 */

import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { businessLogo, designArtwork, productArtwork } from './seed/artwork.js';
import {
  BUSINESS,
  CUSTOMERS,
  DESIGNS,
  EXPENSE_TEMPLATES,
  PRODUCTS,
  SUPPLIERS,
  type ProductSeed,
} from './seed/dataset.js';

const HISTORY_DAYS = 120;
const TARGET_ORDERS = 72;
const RANDOM_SEED = 20260917;
/** Repo root, resolved from this file so the script works from any workspace. */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const DUMP_ROOT = join(REPO_ROOT, '0_never-push-this-dump-folder');
const DESIGN_BUCKET = 'design-assets';
const BUSINESS_BUCKET = 'business-assets';

const ALL_TABLES = [
  'roles', 'permissions', 'role_permissions', 'profiles', 'audit_logs',
  'inventory_items', 'inventory_movements', 'designs', 'orders', 'order_items',
  'sales_transactions', 'sales_transaction_items', 'payments', 'business_settings',
  'customers', 'order_payments', 'suppliers', 'purchase_orders', 'operating_expenses',
] as const;

/** Deleted in this order: every child table is cleared before its parent. */
const WIPE_ORDER = [
  'audit_logs', 'order_payments', 'order_items', 'orders', 'payments',
  'sales_transaction_items', 'sales_transactions', 'inventory_movements',
  'designs', 'inventory_items', 'suppliers',
  'operating_expenses', 'customers',
] as const;

type OrderStatus = 'Pending' | 'Designing' | 'In Production' | 'Ready for Pickup' | 'Completed' | 'Delivered';

// ─── Small utilities ────────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(RANDOM_SEED);

function randomInt(minInclusive: number, maxInclusive: number): number {
  return minInclusive + Math.floor(random() * (maxInclusive - minInclusive + 1));
}

function pickOne<T>(items: readonly T[]): T {
  const value = items[Math.floor(random() * items.length)];
  if (value === undefined) throw new Error('Cannot pick from an empty list.');
  return value;
}

function pickWeighted<T>(items: readonly T[], weight: (item: T) => number): T {
  const total = items.reduce((sum, item) => sum + weight(item), 0);
  let roll = random() * total;
  for (const item of items) {
    roll -= weight(item);
    if (roll <= 0) return item;
  }
  const last = items[items.length - 1];
  if (last === undefined) throw new Error('Cannot pick from an empty list.');
  return last;
}

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Calendar date in Asia/Manila for "offset" days ago (0 = today). */
function manilaDate(offsetDays: number): { year: number; month: number; day: number } {
  const shifted = new Date(Date.now() + 8 * 3_600_000 - offsetDays * 86_400_000);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth(), day: shifted.getUTCDate() };
}

/** ISO instant for a Manila wall-clock time (UTC+8). */
function manilaInstant(date: { year: number; month: number; day: number }, hour: number, minute: number): string {
  return new Date(Date.UTC(date.year, date.month, date.day, hour - 8, minute, 0, 0)).toISOString();
}

function dayKey(date: { year: number; month: number; day: number }): string {
  const month = String(date.month + 1).padStart(2, '0');
  const day = String(date.day).padStart(2, '0');
  return `${date.year}-${month}-${day}`;
}

function weekdayOf(date: { year: number; month: number; day: number }): number {
  return new Date(Date.UTC(date.year, date.month, date.day)).getUTCDay();
}

async function runPool<T>(items: readonly T[], limit: number, worker: (item: T, index: number) => Promise<void>): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      const item = items[index] as T;
      await worker(item, index);
    }
  });
  await Promise.all(runners);
}

async function withRetry<T>(label: string, attempts: number, task: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((done) => setTimeout(done, 250 * attempt));
    }
  }
  throw new Error(`${label} failed after ${attempts} attempts: ${String(lastError)}`);
}

const args = new Set(process.argv.slice(2));
const snapshotOnly = args.has('--snapshot-only');
const skipSnapshot = args.has('--no-snapshot');
const skipUploads = args.has('--no-uploads');
const verifyOnly = args.has('--verify-only');

// ─── Database plumbing ──────────────────────────────────────────────────────

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required. Run this from the backend workspace.`);
  return value;
}

function createServiceClient(): SupabaseClient {
  return createClient(requiredEnvironment('SUPABASE_URL'), requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function fetchAll(supabase: SupabaseClient, table: string): Promise<Array<Record<string, unknown>>> {
  const rows: Array<Record<string, unknown>> = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + pageSize - 1);
    if (error) throw new Error(`Could not read ${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...(data as Array<Record<string, unknown>>));
    if (data.length < pageSize) break;
  }
  return rows;
}

async function countRows(supabase: SupabaseClient, table: string): Promise<number> {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  if (error) throw new Error(`Could not count ${table}: ${error.message}`);
  return count ?? 0;
}

async function snapshot(supabase: SupabaseClient, directory: string): Promise<void> {
  mkdirSync(directory, { recursive: true });
  for (const table of ALL_TABLES) {
    const rows = await fetchAll(supabase, table);
    writeFileSync(join(directory, `${table}.json`), JSON.stringify(rows, null, 2));
    console.log(`  snapshot ${table.padEnd(24)} ${rows.length} rows`);
  }
  console.log(`Snapshot written to ${directory}`);
}

async function wipe(supabase: SupabaseClient): Promise<void> {
  for (const table of WIPE_ORDER) {
    const { error } = await supabase.from(table).delete().not('id', 'is', null);
    if (error) throw new Error(`Could not clear ${table}: ${error.message}`);
    console.log(`  cleared  ${table}`);
  }
}

// ─── Planning (deterministic, computed before any write) ────────────────────

interface PlannedLine {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

interface PlannedSale {
  dayOffset: number;
  createdAt: string;
  lines: PlannedLine[];
  method: 'Cash' | 'Card' | 'Custom Order';
  discount: number;
  subtotal: number;
  tax: number;
  total: number;
  actorId: string;
}

interface PlannedOrder {
  dayOffset: number;
  createdAt: string;
  updatedAt: string;
  customerName: string;
  customerId: string | null;
  status: OrderStatus;
  isCustom: boolean;
  notes: string;
  dueDate: string;
  lines: PlannedLine[];
  designId: string | null;
  amount: number;
  actorId: string;
  payments: Array<{ amount: number; method: 'Cash' | 'Card' | 'Other'; notes: string; createdAt: string }>;
}

function quantityFor(product: ProductSeed): number {
  const skewed = Math.floor(random() ** 2 * (product.maxQty - 1));
  return Math.max(1, 1 + Math.min(skewed, product.maxQty - 1));
}

function planSales(actorIds: readonly string[]): PlannedSale[] {
  const sales: PlannedSale[] = [];
  for (let dayOffset = HISTORY_DAYS - 1; dayOffset >= 0; dayOffset -= 1) {
    const date = manilaDate(dayOffset);
    const weekday = weekdayOf(date);
    const growth = 0.78 + 0.45 * (1 - dayOffset / HISTORY_DAYS);

    let base: number;
    if (weekday === 0) base = randomInt(0, 1);
    else if (weekday === 6) base = randomInt(2, 4);
    else if (weekday === 5) base = randomInt(5, 7);
    else base = randomInt(4, 6);
    if (date.day === 15 || date.day === 30) base += 2;

    let volume = Math.max(1, Math.round(base * growth));
    if (dayOffset === 0) volume = Math.max(3, volume);

    for (let i = 0; i < volume; i += 1) {
      const minute = 8 * 60 + 30 + randomInt(0, 570);
      const hour = 8 + Math.floor((minute - 8 * 60) / 60);
      const lines: PlannedLine[] = [];
      const basketSize = random() < 0.55 ? 1 : random() < 0.85 ? 2 : 3;
      const usedSkus = new Set<string>();
      for (let l = 0; l < basketSize; l += 1) {
        let product = pickWeighted(PRODUCTS, (candidate) => candidate.weight);
        let guard = 0;
        while (usedSkus.has(product.sku) && guard < 10) {
          product = pickWeighted(PRODUCTS, (candidate) => candidate.weight);
          guard += 1;
        }
        usedSkus.add(product.sku);
        lines.push({ sku: product.sku, name: product.name, quantity: quantityFor(product), unitPrice: product.price });
      }

      const subtotal = money(lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
      const discount = random() < 0.08 ? money(Math.round((subtotal * randomInt(5, 10)) / 100 / 10) * 10) : 0;
      const tax = money((subtotal - discount) * (BUSINESS.vatRate / 100));
      const method: PlannedSale['method'] = random() < 0.68 ? 'Cash' : random() < 0.95 ? 'Card' : 'Custom Order';

      sales.push({
        dayOffset,
        createdAt: manilaInstant(date, hour, minute % 60),
        lines,
        method,
        discount,
        subtotal,
        tax,
        total: money(subtotal - discount + tax),
        actorId: pickOne(actorIds),
      });
    }
  }
  return sales;
}

function statusForAge(ageDays: number): OrderStatus {
  if (ageDays > 45) return random() < 0.85 ? 'Delivered' : 'Completed';
  if (ageDays > 25) return random() < 0.55 ? 'Delivered' : 'Completed';
  if (ageDays > 12) return random() < 0.45 ? 'Ready for Pickup' : 'Completed';
  if (ageDays > 5) return random() < 0.5 ? 'In Production' : 'Ready for Pickup';
  if (ageDays > 2) return random() < 0.55 ? 'Designing' : 'In Production';
  return random() < 0.6 ? 'Pending' : 'Designing';
}

function planOrders(actorIds: readonly string[], designIds: readonly string[]): PlannedOrder[] {
  const jobProducts = PRODUCTS.filter((product) =>
    ['Tarpaulin', 'Large Format', 'Apparel', 'Cards & Stationery', 'Giveaways'].includes(product.category),
  );
  const orders: PlannedOrder[] = [];
  for (let i = 0; i < TARGET_ORDERS; i += 1) {
    const dayOffset = Math.floor((i / TARGET_ORDERS) * (HISTORY_DAYS - 2)) + randomInt(0, 2);
    const date = manilaDate(dayOffset);
    const customer = pickWeighted(CUSTOMERS, (candidate) => candidate.weight);
    const product = pickOne(jobProducts);
    const quantity = product.price > 800 ? randomInt(1, 3) : randomInt(2, Math.max(3, Math.min(12, product.maxQty)));
    const lines: PlannedLine[] = [{ sku: product.sku, name: product.name, quantity, unitPrice: product.price }];
    if (random() < 0.35) {
      const extra = pickOne(jobProducts);
      if (extra.sku !== product.sku) {
        lines.push({ sku: extra.sku, name: extra.name, quantity: randomInt(1, 4), unitPrice: extra.price });
      }
    }

    const amount = money(lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
    const isCustom = product.category === 'Tarpaulin' || product.category === 'Apparel' || random() < 0.2;
    const status = statusForAge(dayOffset);
    const leadTime = isCustom ? randomInt(7, 16) : randomInt(2, 7);
    const due = manilaDate(Math.max(0, dayOffset - leadTime));
    const createdAt = manilaInstant(date, 8 + randomInt(0, 9), randomInt(0, 59));
    const progressed = status === 'Pending' ? randomInt(0, 6) : randomInt(6, 40);

    const payments: PlannedOrder['payments'] = [];
    if (random() < 0.7) {
      const downpayment = money(amount * (random() < 0.75 ? 0.5 : 1));
      payments.push({ amount: downpayment, method: random() < 0.7 ? 'Cash' : 'Card', notes: 'Downpayment received', createdAt });
      if (downpayment < amount && (status === 'Completed' || status === 'Delivered')) {
        const balanceDay = Math.max(0, dayOffset - randomInt(1, Math.max(1, leadTime)));
        const balanceDate = manilaDate(balanceDay);
        payments.push({
          amount: money(amount - downpayment),
          method: random() < 0.6 ? 'Cash' : 'Card',
          notes: 'Balance settled on pickup',
          createdAt: manilaInstant(balanceDate, 9 + randomInt(0, 8), randomInt(0, 59)),
        });
      }
    }

    orders.push({
      dayOffset,
      createdAt,
      updatedAt: manilaInstant(manilaDate(Math.max(0, dayOffset - Math.floor(progressed / 24))), 9 + randomInt(0, 8), randomInt(0, 59)),
      customerName: customer.name,
      customerId: null,
      status,
      isCustom,
      notes: isCustom ? 'Client supplied print-ready artwork.' : 'Standard job, stock materials.',
      dueDate: dayKey(due),
      lines,
      designId: isCustom && designIds.length > 0 ? pickOne(designIds) : null,
      amount,
      actorId: pickOne(actorIds),
      payments,
    });
  }
  return orders.sort((a, b) => b.dayOffset - a.dayOffset);
}

// ─── Seeding steps ──────────────────────────────────────────────────────────

async function uploadArtwork(supabase: SupabaseClient, bucket: string, path: string, svg: string): Promise<string> {
  const { error } = await supabase.storage.from(bucket).upload(path, Buffer.from(svg, 'utf8'), {
    contentType: 'image/svg+xml',
    upsert: true,
  });
  if (error) throw new Error(`Could not upload ${path}: ${error.message}`);
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

async function seedSettings(supabase: SupabaseClient, adminId: string): Promise<void> {
  if (!skipUploads) {
    const logoUrl = await uploadArtwork(supabase, BUSINESS_BUCKET, 'seed/logo.svg', businessLogo(BUSINESS.name));
    const { error } = await supabase
      .from('business_settings')
      .update({ business_name: BUSINESS.name, vat_rate: BUSINESS.vatRate, currency_symbol: BUSINESS.currencySymbol, logo_url: logoUrl, updated_by: adminId })
      .eq('id', 1);
    if (error) throw new Error(`Could not update business settings: ${error.message}`);
  } else {
    const { error } = await supabase
      .from('business_settings')
      .update({ business_name: BUSINESS.name, vat_rate: BUSINESS.vatRate, currency_symbol: BUSINESS.currencySymbol, updated_by: adminId })
      .eq('id', 1);
    if (error) throw new Error(`Could not update business settings: ${error.message}`);
  }
  console.log(`  business settings set to ${BUSINESS.name} at ${BUSINESS.vatRate}% VAT`);
}

async function seedCustomers(supabase: SupabaseClient): Promise<Map<string, string>> {
  const rows = CUSTOMERS.map((customer) => ({
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    notes: customer.notes,
    created_at: manilaInstant(manilaDate(HISTORY_DAYS - randomInt(0, 20)), 9, randomInt(0, 59)),
    updated_at: manilaInstant(manilaDate(randomInt(0, 10)), 10, randomInt(0, 59)),
  }));
  const { data, error } = await supabase.from('customers').insert(rows).select('id, name');
  if (error || !data) throw new Error(`Could not create customers: ${error?.message ?? 'no rows returned'}`);
  const byName = new Map<string, string>();
  for (const row of data as Array<{ id: string; name: string }>) byName.set(row.name, row.id);
  console.log(`  ${byName.size} customers created`);
  return byName;
}

async function seedSuppliers(supabase: SupabaseClient): Promise<string[]> {
  const rows = SUPPLIERS.map((supplier) => ({
    name: supplier.name,
    contact_person: supplier.contactPerson,
    phone: supplier.phone,
    email: supplier.email,
    address: supplier.address,
    created_at: manilaInstant(manilaDate(HISTORY_DAYS + randomInt(0, 30)), 9, randomInt(0, 59)),
    updated_at: manilaInstant(manilaDate(randomInt(0, 15)), 9, randomInt(0, 59)),
  }));
  const { data, error } = await supabase.from('suppliers').insert(rows).select('id');
  if (error || !data) throw new Error(`Could not create suppliers: ${error?.message ?? 'no rows returned'}`);
  const ids = (data as Array<{ id: string }>).map((row) => row.id);
  console.log(`  ${ids.length} suppliers created`);
  return ids;
}

async function seedDesigns(supabase: SupabaseClient, adminId: string): Promise<string[]> {
  const rows = [];
  for (const design of DESIGNS) {
    const slug = design.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const svg = designArtwork(design.name, design.category, design.tags);
    let imageUrl: string;
    if (skipUploads) {
      const { data } = supabase.storage.from(DESIGN_BUCKET).getPublicUrl(`seed/designs/${slug}.svg`);
      imageUrl = data.publicUrl;
    } else {
      imageUrl = await uploadArtwork(supabase, DESIGN_BUCKET, `seed/designs/${slug}.svg`, svg);
    }
    const createdAt = manilaInstant(manilaDate(randomInt(1, HISTORY_DAYS - 5)), 9 + randomInt(0, 8), randomInt(0, 59));
    rows.push({
      name: design.name,
      category: design.category,
      image_url: imageUrl,
      tags: design.tags,
      asset_type: 'image/svg+xml',
      asset_size_bytes: Buffer.byteLength(svg, 'utf8'),
      created_by: adminId,
      created_at: createdAt,
      updated_at: createdAt,
    });
  }
  const { data, error } = await supabase.from('designs').insert(rows).select('id');
  if (error || !data) throw new Error(`Could not create designs: ${error?.message ?? 'no rows returned'}`);
  const ids = (data as Array<{ id: string }>).map((row) => row.id);
  console.log(`  ${ids.length} designs created`);
  return ids;
}

interface SeededInventory {
  bySku: Map<string, { id: string; stock: number; target: number; reorderLevel: number }>;
}

async function seedInventory(
  supabase: SupabaseClient,
  adminId: string,
  soldBySku: ReadonlyMap<string, number>,
  reservedBySku: ReadonlyMap<string, number>,
): Promise<SeededInventory> {
  const createdAt = manilaInstant(manilaDate(HISTORY_DAYS + 5), 8, 0);
  const rows = [];
  for (const product of PRODUCTS) {
    let imageUrl: string | null = null;
    if (!skipUploads) {
      imageUrl = await uploadArtwork(
        supabase,
        DESIGN_BUCKET,
        `seed/products/${product.sku.toLowerCase()}.svg`,
        productArtwork(product.name, product.category, product.sku),
      );
    }
    rows.push({
      sku: product.sku,
      name: product.name,
      category: product.category,
      stock: 0,
      reorder_level: product.reorderLevel,
      price: product.price,
      cost_price: product.cost,
      image_url: imageUrl,
      created_at: createdAt,
      updated_at: createdAt,
    });
  }
  const { data, error } = await supabase.from('inventory_items').insert(rows).select('id, sku, stock');
  if (error || !data) throw new Error(`Could not create inventory items: ${error?.message ?? 'no rows returned'}`);

  const bySku = new Map<string, { id: string; stock: number; target: number; reorderLevel: number }>();
  for (const row of data as Array<{ id: string; sku: string; stock: number }>) {
    const product = PRODUCTS.find((candidate) => candidate.sku === row.sku);
    if (!product) continue;
    bySku.set(row.sku, { id: row.id, stock: 0, target: product.targetStock, reorderLevel: product.reorderLevel });
  }

  // Opening stock covers every unit the replayed history will consume, plus a
  // small buffer the closing stock take later trims back to target.
  for (const [sku, entry] of bySku) {
    const opening = entry.target + (soldBySku.get(sku) ?? 0) + (reservedBySku.get(sku) ?? 0) + 3;
    await withRetry(`Opening stock for ${sku}`, 3, async () => {
      const { error: rpcError } = await supabase.rpc('adjust_inventory_stock', {
        p_item_id: entry.id,
        p_quantity: opening,
        p_reason: 'Opening inventory count',
        p_actor_id: adminId,
      });
      if (rpcError) throw new Error(rpcError.message);
    });
  }
  console.log(`  ${bySku.size} products created with opening stock`);
  return { bySku };
}

async function createOrders(
  supabase: SupabaseClient,
  orders: readonly PlannedOrder[],
  inventory: SeededInventory,
  customerIds: ReadonlyMap<string, string>,
): Promise<Array<{ id: string; order: PlannedOrder }>> {
  const created: Array<{ id: string; order: PlannedOrder }> = [];
  await runPool(orders, 6, async (order) => {
    const items = order.lines.map((line) => {
      const entry = inventory.bySku.get(line.sku);
      return {
        itemId: entry?.id ?? null,
        designId: order.designId,
        name: line.name,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      };
    });
    const customerId = customerIds.get(order.customerName) ?? null;
    const record = await withRetry(`Order for ${order.customerName}`, 3, async () => {
      const { data, error } = await supabase.rpc('create_order_with_items', {
        p_customer: order.customerName,
        p_status: order.status,
        p_amount: order.amount,
        p_notes: order.notes,
        p_is_custom: order.isCustom,
        p_created_by: order.actorId,
        p_items: items,
        p_customer_id: customerId,
        p_due_date: order.dueDate,
      });
      if (error || !data) throw new Error(error?.message ?? 'no order returned');
      return data as { id: string };
    });
    await supabase.from('orders').update({ created_at: order.createdAt, updated_at: order.updatedAt }).eq('id', record.id);
    created.push({ id: record.id, order });
  });
  console.log(`  ${created.length} orders created across all statuses`);
  return created;
}

async function createOrderPayments(
  supabase: SupabaseClient,
  created: ReadonlyArray<{ id: string; order: PlannedOrder }>,
): Promise<void> {
  const rows = created.flatMap(({ id, order }) =>
    order.payments.map((payment) => ({
      order_id: id,
      amount: payment.amount,
      method: payment.method,
      notes: payment.notes,
      created_by: order.actorId,
      created_at: payment.createdAt,
    })),
  );
  if (rows.length === 0) return;
  const { error } = await supabase.from('order_payments').insert(rows);
  if (error) throw new Error(`Could not record order payments: ${error.message}`);
  console.log(`  ${rows.length} order payments recorded`);
}

async function createSales(
  supabase: SupabaseClient,
  sales: readonly PlannedSale[],
  inventory: SeededInventory,
): Promise<void> {
  const stamped: Array<{ id: string; createdAt: string; actorId: string }> = [];
  await runPool(sales, 8, async (sale, index) => {
    const items = sale.lines.map((line) => ({
      itemId: inventory.bySku.get(line.sku)?.id ?? null,
      name: line.name,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    }));
    const record = await withRetry(`Sale ${index}`, 3, async () => {
      const { data, error } = await supabase.rpc('create_transaction_with_payment', {
        p_subtotal: sale.subtotal,
        p_discount: sale.discount,
        p_tax: sale.tax,
        p_total: sale.total,
        p_payment_method: sale.method,
        p_received_amount: sale.total,
        p_created_by: sale.actorId,
        p_items: items,
        p_idempotency_key: `seed-${RANDOM_SEED}-${index}`,
      });
      if (error || !data) throw new Error(error?.message ?? 'no transaction returned');
      return data as { id: string };
    });
    stamped.push({ id: record.id, createdAt: sale.createdAt, actorId: sale.actorId });
  });

  await runPool(stamped, 8, async ({ id, createdAt }) => {
    await supabase.from('sales_transactions').update({ created_at: createdAt }).eq('id', id);
  });

  const { data: payments, error: paymentError } = await supabase.from('payments').select('id, transaction_id');
  if (paymentError || !payments) throw new Error(`Could not read payments: ${paymentError?.message ?? 'no rows'}`);
  const createdAtByTransaction = new Map(stamped.map((entry) => [entry.id, entry.createdAt]));
  const paymentUpdates = (payments as Array<{ id: string; transaction_id: string }>)
    .map((payment) => ({ id: payment.id, createdAt: createdAtByTransaction.get(payment.transaction_id) }))
    .filter((entry): entry is { id: string; createdAt: string } => Boolean(entry.createdAt));
  await runPool(paymentUpdates, 8, async ({ id, createdAt }) => {
    await supabase.from('payments').update({ created_at: createdAt }).eq('id', id);
  });

  // Two mis-keyed sales, voided straight away: shows the void flow in history.
  const voidable = stamped.filter((_, index) => index % 240 === 7).slice(0, 2);
  for (const entry of voidable) {
    await supabase.rpc('void_transaction', { p_transaction_id: entry.id, p_voided_by: entry.actorId });
  }

  console.log(`  ${stamped.length} sales created, ${voidable.length} voided`);
}

async function reconcileStock(supabase: SupabaseClient, inventory: SeededInventory, adminId: string): Promise<void> {
  const { data, error } = await supabase.from('inventory_items').select('id, sku, stock');
  if (error || !data) throw new Error(`Could not reconcile stock: ${error?.message ?? 'no rows'}`);
  let adjusted = 0;
  for (const row of data as Array<{ id: string; sku: string; stock: number }>) {
    const entry = inventory.bySku.get(row.sku);
    if (!entry) continue;
    const delta = row.stock - entry.target;
    if (delta === 0) continue;
    await supabase.rpc('adjust_inventory_stock', {
      p_item_id: row.id,
      p_quantity: -delta,
      p_reason: 'Monthly stock take correction',
      p_actor_id: adminId,
    });
    adjusted += 1;
  }
  console.log(`  stock take reconciled ${adjusted} items to their planned levels`);
}

async function seedExpenses(supabase: SupabaseClient, adminId: string): Promise<void> {
  const rows = [];
  const months = Math.max(1, Math.round(HISTORY_DAYS / 30));
  for (const template of EXPENSE_TEMPLATES) {
    for (let month = 0; month < months; month += 1) {
      for (let occurrence = 0; occurrence < template.perMonth; occurrence += 1) {
        const dayOffset = month * 30 + (template.perMonth === 1 ? 3 : 2 + occurrence * 15) + randomInt(0, 3);
        if (dayOffset >= HISTORY_DAYS) continue;
        const jitter = 0.9 + random() * 0.22;
        rows.push({
          category: template.category,
          description: template.description,
          amount: money(template.amount * jitter),
          expense_date: dayKey(manilaDate(dayOffset)),
          created_by: adminId,
          created_at: manilaInstant(manilaDate(dayOffset), 17, randomInt(0, 59)),
        });
      }
    }
  }
  const { error } = await supabase.from('operating_expenses').insert(rows);
  if (error) throw new Error(`Could not create expenses: ${error.message}`);
  console.log(`  ${rows.length} operating expenses recorded`);
}

async function seedAuditLog(
  supabase: SupabaseClient,
  actorIds: readonly string[],
  orders: ReadonlyArray<{ id: string; order: PlannedOrder }>,
  designIds: readonly string[],
  supplierIds: readonly string[],
): Promise<void> {
  const rows: Array<Record<string, unknown>> = [];
  const push = (action: string, entityType: string, entityId: string | null, createdAt: string, metadata: Record<string, unknown> = {}) => {
    rows.push({
      actor_id: pickOne(actorIds),
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
      ip_address: null,
      user_agent: 'PrintSync seed',
      created_at: createdAt,
    });
  };

  push('settings.business_updated', 'business_settings', '1', manilaInstant(manilaDate(HISTORY_DAYS), 8, 5), { businessName: BUSINESS.name, vatRate: BUSINESS.vatRate });

  for (const customer of CUSTOMERS) {
    push('customer.created', 'customer', null, manilaInstant(manilaDate(randomInt(1, HISTORY_DAYS - 5)), 9, randomInt(0, 59)), { name: customer.name });
  }
  for (const designId of designIds) {
    push('design.created', 'design', designId, manilaInstant(manilaDate(randomInt(1, HISTORY_DAYS - 5)), 10, randomInt(0, 59)), {});
  }
  for (const supplierId of supplierIds) {
    push('supplier.created', 'supplier', supplierId, manilaInstant(manilaDate(HISTORY_DAYS - randomInt(0, 10)), 11, randomInt(0, 59)), {});
  }

  let orderUpdateCount = 0;
  for (const { id, order } of orders) {
    push('order.created', 'order', id, order.createdAt, { customer: order.customerName, status: 'Pending' });
    if (order.status !== 'Pending' && orderUpdateCount < 90) {
      push('order.updated', 'order', id, order.updatedAt, { status: order.status });
      orderUpdateCount += 1;
    }
    for (const payment of order.payments) {
      push('order_payment.created', 'order_payment', id, payment.createdAt, { amount: payment.amount, method: payment.method });
    }
  }

  for (let i = 0; i < 40; i += 1) {
    push('inventory.adjusted', 'inventory_item', null, manilaInstant(manilaDate(randomInt(0, HISTORY_DAYS - 1)), 13, randomInt(0, 59)), { reason: 'Stock replenishment' });
  }
  for (let i = 0; i < 24; i += 1) {
    push('auth.login_succeeded', 'auth', null, manilaInstant(manilaDate(randomInt(0, 30)), 8, randomInt(0, 25)), {});
  }

  const { data: transactions, error } = await supabase
    .from('sales_transactions')
    .select('id, total, created_at')
    .order('created_at', { ascending: false })
    .limit(120);
  if (!error && transactions) {
    for (const transaction of transactions as Array<{ id: string; total: number; created_at: string }>) {
      push('transaction.created', 'sales_transaction', transaction.id, transaction.created_at, { total: transaction.total });
    }
  }

  const { data: expenses } = await supabase.from('operating_expenses').select('id, category, amount, created_at').limit(30);
  if (expenses) {
    for (const expense of expenses as Array<{ id: string; category: string; amount: number; created_at: string }>) {
      push('expense.created', 'expense', expense.id, expense.created_at, { category: expense.category, amount: expense.amount });
    }
  }

  const chunkSize = 200;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const { error: insertError } = await supabase.from('audit_logs').insert(rows.slice(index, index + chunkSize));
    if (insertError) throw new Error(`Could not write audit log: ${insertError.message}`);
  }
  console.log(`  ${rows.length} audit entries written`);
}

// ─── Verification ───────────────────────────────────────────────────────────

async function verify(supabase: SupabaseClient): Promise<void> {
  console.log('\nVerification');
  for (const table of ALL_TABLES) {
    console.log(`  ${table.padEnd(24)} ${await countRows(supabase, table)}`);
  }

  const ranges: Array<[string, number]> = [['last 7 days', 6], ['last 30 days', 29], ['last 90 days', 89]];
  for (const [label, offset] of ranges) {
    const from = manilaInstant(manilaDate(offset), 0, 0);
    const to = manilaInstant(manilaDate(0), 23, 59);
    const { data, error } = await supabase.rpc('get_analytics_summary', { p_from: from, p_to: to });
    if (error) {
      console.log(`  analytics ${label}: RPC error - ${error.message}`);
      continue;
    }
    const summary = data as { revenue?: number; transactionCount?: number; orderCount?: number };
    console.log(
      `  analytics ${label.padEnd(14)} revenue ${BUSINESS.currencySymbol}${Number(summary.revenue ?? 0).toLocaleString('en-PH')} · ${summary.transactionCount ?? 0} sales · ${summary.orderCount ?? 0} orders`,
    );
  }

  const { data: lowStock } = await supabase.from('inventory_items').select('sku, name, stock, reorder_level');
  const alerts = (lowStock as Array<{ sku: string; name: string; stock: number; reorder_level: number }> | null)?.filter(
    (item) => item.stock <= item.reorder_level,
  ) ?? [];
  console.log(`  low stock alerts: ${alerts.length}${alerts.length ? ` (${alerts.map((item) => item.sku).join(', ')})` : ''}`);

  const { data: statusRows } = await supabase.from('orders').select('status');
  const byStatus = new Map<string, number>();
  for (const row of (statusRows ?? []) as Array<{ status: string }>) {
    byStatus.set(row.status, (byStatus.get(row.status) ?? 0) + 1);
  }
  console.log(`  orders by status: ${[...byStatus.entries()].map(([status, count]) => `${status} ${count}`).join(' · ')}`);
}

// ─── Entry point ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const supabase = createServiceClient();
  const startedAt = Date.now();

  if (verifyOnly) {
    await verify(supabase);
    return;
  }

  if (!skipSnapshot) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    console.log('Snapshot');
    await snapshot(supabase, join(DUMP_ROOT, 'backups', stamp));
    if (snapshotOnly) {
      console.log('\nNothing was modified.');
      return;
    }
  }

  const { data: profiles, error: profileError } = await supabase.from('profiles').select('id, name').order('name');
  if (profileError || !profiles || profiles.length === 0) throw new Error('No staff profiles found; nothing to attribute history to.');
  const staff = profiles as Array<{ id: string; name: string }>;
  const actorIds = staff.map((person) => person.id);
  const adminId = actorIds[0] as string;

  console.log('\nWipe');
  await wipe(supabase);

  console.log('\nReference data');
  await seedSettings(supabase, adminId);
  const customerIds = await seedCustomers(supabase);
  const supplierIds = await seedSuppliers(supabase);
  const designIds = await seedDesigns(supabase, adminId);

  console.log('\nPlan history');
  const sales = planSales(actorIds);
  const orders = planOrders(actorIds, designIds);
  const soldBySku = new Map<string, number>();
  for (const sale of sales) {
    for (const line of sale.lines) soldBySku.set(line.sku, (soldBySku.get(line.sku) ?? 0) + line.quantity);
  }
  const reservedBySku = new Map<string, number>();
  for (const order of orders) {
    for (const line of order.lines) reservedBySku.set(line.sku, (reservedBySku.get(line.sku) ?? 0) + line.quantity);
  }
  console.log(`  planned ${sales.length} sales and ${orders.length} orders over ${HISTORY_DAYS} days`);

  console.log('\nOperational history');
  const inventory = await seedInventory(supabase, adminId, soldBySku, reservedBySku);
  const createdOrders = await createOrders(supabase, orders, inventory, customerIds);
  await createOrderPayments(supabase, createdOrders);
  await createSales(supabase, sales, inventory);
  await reconcileStock(supabase, inventory, adminId);
  await seedExpenses(supabase, adminId);
  await seedAuditLog(supabase, actorIds, createdOrders, designIds, supplierIds);

  await verify(supabase);
  console.log(`\nDone in ${Math.round((Date.now() - startedAt) / 1000)}s.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Seeding failed.');
  process.exitCode = 1;
});
