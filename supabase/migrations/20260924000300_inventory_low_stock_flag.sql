-- Phase 4b: materialise the "low stock" predicate as a generated column.
--
-- The Workspace's Low stock card links to `/inventory?lowStock=1`, and that list
-- must return exactly the rows the summary's `lowStock` count is built from, so
-- the two numbers can never disagree. The summary counts
-- `where stock <= reorder_level` in pure SQL; PostgREST's filter DSL cannot
-- compare two columns, so the list cannot express that predicate as a query
-- parameter. A stored generated column carries the identical expression and is
-- recomputed on every stock/reorder change, so the list filter `is_low_stock =
-- true` and the summary count are the same rows by construction.
--
-- `stock` and `reorder_level` are both NOT NULL with a >= 0 check (see
-- 20260910000700_inventory.sql), so the comparison is always well defined and the
-- column is never null. Adding it is additive: no existing column or row is
-- altered, and the column is excluded from the list's explicit select.

alter table public.inventory_items
  add column is_low_stock boolean
  generated always as (stock <= reorder_level) stored;
