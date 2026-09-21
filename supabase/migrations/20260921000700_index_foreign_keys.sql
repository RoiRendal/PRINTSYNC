-- Index the foreign keys that had no usable index.
--
-- PostgreSQL does not index the child side of a foreign key automatically, and
-- nothing warns you about it. Without an index, every delete or key update on the
-- *parent* table scans the whole child table to check the constraint, and so does
-- any query that filters on the column.
--
-- That is the shape of a problem that arrives slowly rather than loudly.
-- Everything returns correct answers today; it just gets steadily slower as the
-- shop accumulates sales, and it surfaces as "the system feels slow now" rather
-- than as a bug anybody can point at. There is no error message to search for.
--
-- Replaying the set from empty found exactly twelve. `replay-migrations.mjs`
-- now asserts this, so the list cannot quietly grow again — the end-state check
-- reads `foreign keys with no usable index: 0`.
--
-- Coverage rule: an index on `(a, b)` covers a foreign key on `a` but not one on
-- `b`, so only the leading column counts. Every index below is single-column, so
-- each covers exactly one constraint and nothing is being assumed about a
-- composite that does not exist.
--
-- Two deliberate choices:
--
--   * Plain indexes, not partial `where col is not null` ones. A partial index
--     would be smaller on the nullable columns (`design_id`, `voided_by`,
--     `received_by`), and PostgreSQL's referential-integrity check could still
--     use it. But these columns are mostly populated, the saving is marginal, and
--     a plain index is one fewer thing to reason about when reading a plan.
--   * `purchase_orders (created_by)` is indexed even though whether that table
--     should exist at all is an open question. An index costs nothing if the
--     table is later dropped, and leaving it unindexed would hold this assertion
--     red — which is how a gate gets ignored.

create index if not exists business_settings_updated_by_idx
  on public.business_settings (updated_by);

create index if not exists designs_created_by_idx
  on public.designs (created_by);

create index if not exists inventory_movements_actor_id_idx
  on public.inventory_movements (actor_id);

create index if not exists operating_expenses_created_by_idx
  on public.operating_expenses (created_by);

create index if not exists order_items_design_id_idx
  on public.order_items (design_id);

create index if not exists order_items_inventory_item_id_idx
  on public.order_items (inventory_item_id);

create index if not exists order_payments_created_by_idx
  on public.order_payments (created_by);

create index if not exists orders_created_by_idx
  on public.orders (created_by);

create index if not exists payments_received_by_idx
  on public.payments (received_by);

create index if not exists purchase_orders_created_by_idx
  on public.purchase_orders (created_by);

create index if not exists sales_transactions_created_by_idx
  on public.sales_transactions (created_by);

create index if not exists sales_transactions_voided_by_idx
  on public.sales_transactions (voided_by);
