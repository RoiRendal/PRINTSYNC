-- Composite index for analytics queries that filter by status and created_at range
-- Used by getAnalyticsSummary, getSalesTimeline, getProductTrends, getInventoryForecast
create index if not exists sales_transactions_status_created_idx
  on public.sales_transactions (status, created_at desc);

-- Index for joining sales_transaction_items to inventory_items in forecast queries
create index if not exists sales_transaction_items_inventory_item_idx
  on public.sales_transaction_items (inventory_item_id)
  where inventory_item_id is not null;

-- Composite index for sales_transaction_items joined to transactions by created_at
-- Supports the Supabase inner-join select pattern used in analytics queries
create index if not exists sales_transaction_items_transaction_created_idx
  on public.sales_transaction_items (transaction_id);

-- Index for inventory_items stock-level checks (inventory alerts, forecast status)
create index if not exists inventory_items_stock_reorder_idx
  on public.inventory_items (stock, reorder_level);
