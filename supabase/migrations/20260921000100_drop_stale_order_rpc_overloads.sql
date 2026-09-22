-- Drop two superseded RPC arities that `create or replace` left behind.
--
-- `create or replace function` with a CHANGED parameter list creates a NEW overload; it does not
-- remove the old one. So the order RPCs accumulated stale arities:
--
--   create_order_with_items(text,text,numeric,text,boolean,uuid,jsonb)
--       superseded by the 9-arg version in 20260910002400_update_order_rpc.sql
--
--   replace_order_with_items(uuid,text,text,numeric,text,boolean,jsonb,uuid)
--       superseded by the 11-arg version in 20260916000001_optimistic_order_updates.sql
--
-- Why they matter: the stale bodies predate `p_customer_id` / `p_due_date` and, for replace, the
-- `p_expected_updated_at` compare-and-swap. A call that resolves to one of them silently drops the
-- customer and due date and skips the "has this order changed underneath me?" check. They also make
-- a 7-argument call ambiguous, because the 9-arg version supplies defaults for its last two
-- parameters.
--
-- Safe to drop: both the API (backend/src/modules/orders/orders.service.ts:165,229) and the demo
-- seeder (backend/src/scripts/seedDemoData.ts:572) pass the full named argument list.

drop function if exists public.create_order_with_items(
  text, text, numeric, text, boolean, uuid, jsonb
);

drop function if exists public.replace_order_with_items(
  uuid, text, text, numeric, text, boolean, jsonb, uuid
);
