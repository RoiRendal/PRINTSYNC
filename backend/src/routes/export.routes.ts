import { Router, type Response } from 'express';
import { getSupabaseAdminClient } from '../integrations/supabase/adminClient.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/authorize.js';
import { exportOrders } from '../modules/orders/orders.service.js';
import { exportInventory } from '../modules/inventory/inventory.service.js';
import { exportTransactions } from '../modules/payments/payments.service.js';
import { AppError } from '../shared/errors.js';
import { formatCsvHeaders, formatCsvRow } from '../shared/csv.js';
import { getShopTimeZone, shopToday } from '../shared/shopClock.js';

export const exportRouter = Router();

function getSupabase() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new AppError(503, 'SUPABASE_NOT_CONFIGURED', 'Supabase has not been configured for this environment.');
  return supabase;
}

function setCsvHeaders(response: Response, filename: string) {
  response.setHeader('Content-Type', 'text/csv; charset=utf-8');
  response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
}

exportRouter.get('/orders', authenticate, requirePermission('orders.read'), async (_request, response) => {
  const supabase = getSupabase();
  const orders = await exportOrders(supabase);
  // Named for the shop's date, so a file exported at 07:00 local is not stamped
  // with yesterday.
  const date = shopToday(await getShopTimeZone(supabase));
  setCsvHeaders(response, `orders_${date}.csv`);
  response.write(formatCsvHeaders(['ID', 'Customer', 'Item', 'Quantity', 'Status', 'Date', 'Amount', 'Total Paid', 'Balance Due', 'Due Date', 'Is Custom']));
  for (const order of orders) {
    response.write(formatCsvRow([
      order.id,
      order.customer,
      order.item,
      order.quantity,
      order.status,
      order.date,
      order.amount,
      order.totalPaid,
      order.balanceDue,
      order.dueDate ?? '',
      order.isCustom ? 'Yes' : 'No',
    ]));
  }
  response.end();
});

exportRouter.get('/inventory', authenticate, requirePermission('inventory.read'), async (_request, response) => {
  const supabase = getSupabase();
  const items = await exportInventory(supabase);
  const date = shopToday(await getShopTimeZone(supabase));
  setCsvHeaders(response, `inventory_${date}.csv`);
  response.write(formatCsvHeaders(['ID', 'SKU', 'Name', 'Category', 'Stock', 'Reorder Level', 'Price', 'Cost Price', 'Image URL', 'Created At', 'Updated At']));
  for (const item of items) {
    response.write(formatCsvRow([
      item.id,
      item.sku,
      item.name,
      item.category,
      item.stock,
      item.reorderLevel,
      item.price,
      item.costPrice,
      item.imageUrl ?? '',
      item.createdAt,
      item.updatedAt,
    ]));
  }
  response.end();
});

exportRouter.get('/transactions', authenticate, requirePermission('payments.read'), async (_request, response) => {
  const supabase = getSupabase();
  const transactions = await exportTransactions(supabase);
  const date = shopToday(await getShopTimeZone(supabase));
  setCsvHeaders(response, `transactions_${date}.csv`);
  response.write(formatCsvHeaders(['ID', 'Date', 'Status', 'Payment Method', 'Subtotal', 'Discount', 'Tax', 'Total', 'Payment Amount', 'Items']));
  for (const transaction of transactions) {
    response.write(formatCsvRow([
      transaction.id,
      transaction.date,
      transaction.status,
      transaction.paymentMethod,
      transaction.subtotal,
      transaction.discount,
      transaction.tax,
      transaction.total,
      transaction.paymentAmount,
      transaction.items.map((i) => `${i.quantity}x ${i.name}`).join('; '),
    ]));
  }
  response.end();
});
