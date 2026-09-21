-- Fix a duplicate index name that made the migration set impossible to replay from scratch.
--
-- `orders_customer_idx` was created twice, with two different definitions:
--   20260910001000_orders.sql:24         gin(to_tsvector('simple', customer))
--   20260910002100_order_due_date.sql:4  btree(customer_id)
--
-- Both are plain `create index`, the second collides, and there is no `drop index` anywhere in the
-- set. On a fresh `supabase db push` the second statement aborts — and because a Supabase migration
-- runs in a single transaction, that migration's `customer_id` and `due_date` columns roll back with
-- it, which the order RPCs depend on.
--
-- This migration converges the LIVE database whichever of the two indexes currently owns the name:
-- it drops the ambiguous name and recreates both under unambiguous ones. The two historical
-- migrations are renamed in the same change so the set replays cleanly. On a fresh replay this file
-- is a no-op — by the time it runs, neither `orders_customer_idx` nor a collision exists.
--
-- LIVE STATE IS UNVERIFIED: the running system evidently has `orders.customer_id`, which the
-- migration set as written could not have produced. This is written to converge from either state
-- rather than assume one.

drop index if exists public.orders_customer_idx;

-- The btree on customer_id: joins and lookups.
create index if not exists orders_customer_id_idx on public.orders(customer_id);

-- The GIN index behind the customer text search. Kept, under a name of its own.
create index if not exists orders_customer_fts_idx
  on public.orders using gin(to_tsvector('simple', customer));
