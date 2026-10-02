-- Scope the analytics summary to a branch — or to all of them.
--
-- `get_analytics_summary(p_from, p_to)` has aggregated business-wide since it was
-- written (20260910001500_analytics_summary_rpc.sql, repaired in
-- 20260917000000_fix_analytics_summary_rpc.sql). That was correct for one shop and
-- is wrong for two: a Balayan manager opening the dashboard would see Nasugbu's
-- revenue added to their own, and a "top items" list merged from both shops.
--
-- Phase 2 tagged `orders`, `sales_transactions`, `sales_transaction_items` (via
-- its parent) and `inventory_items` with a branch. This migration is the read
-- side of that work: every one of the function's five aggregates gains a
-- `branch_id = p_branch_id` predicate.
--
-- ## One parameter, two meanings — and why nullable is the honest choice
--
-- `p_branch_id` is deliberately **nullable**, and `null` means "every branch".
--
-- The head-office account is the one caller that legitimately wants the combined
-- figure (Phase 4's analytics surface defaults to "All branches"). Encoding that
-- as a second boolean — `p_all_branches` — would allow the nonsensical
-- combination `(p_branch_id => 'bal', p_all_branches => true)` and would need its
-- own validation to reject it. `null = all` has no such state: there is exactly
-- one parameter, so there is nothing for two arguments to disagree about.
--
-- A *staff* caller can never reach the `null` path, because `p_branch_id` is
-- supplied by the API from `request.auth.profile.branchId` (never from the query
-- string — see `scripts/check-branch-source.mjs`). The function is
-- `security definer` and granted to `service_role` alone, so the service-role key
-- is the only thing that can call it at all; Postgres itself never decides who
-- may ask for which branch.
--
-- ## The parameter list changes, so the old arity must be dropped
--
-- `create or replace` with a different parameter list leaves the previous
-- two-argument version beside the new three-argument one as a second overload —
-- the trap `20260921000100_drop_stale_order_rpc_overloads.sql` exists to clean up,
-- and the same trap 20261002000500_orders_summary_branch.sql avoided for
-- `get_orders_summary`. Both old versions are dropped explicitly here: the
-- original definition and the repaired one share the same `(timestamptz,
-- timestamptz)` signature, so one `drop` covers them.
--
-- The new parameter is given a `default null` so the JSON payload keeps its shape
-- and a three-argument call is unambiguous. The replay's overload check asserts
-- afterwards that exactly one `get_analytics_summary` remains.

drop function if exists public.get_analytics_summary(timestamptz, timestamptz);

create or replace function public.get_analytics_summary(
  p_from timestamptz,
  p_to timestamptz,
  -- Null means "all branches" — the head-office combined view. See the header.
  p_branch_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if p_from is null or p_to is null then
    raise exception 'An analytics range requires both a from and a to instant';
  end if;

  select jsonb_build_object(
    'revenue', coalesce((
      select sum(total) from sales_transactions
      where status = 'completed'
        and created_at >= p_from and created_at <= p_to
        and (p_branch_id is null or branch_id = p_branch_id)
    ), 0),
    'transactionCount', coalesce((
      select count(*) from sales_transactions
      where status = 'completed'
        and created_at >= p_from and created_at <= p_to
        and (p_branch_id is null or branch_id = p_branch_id)
    ), 0),
    'orderCount', coalesce((
      select count(*) from orders
      where created_at >= p_from and created_at <= p_to
        and (p_branch_id is null or branch_id = p_branch_id)
    ), 0),
    /*
     * `at time zone` rather than `to_char(created_at, ...)`.
     *
     * The old expression bucketed on the *UTC* calendar day, which for a UTC+8
     * shop split one business morning across two points (see
     * `backend/src/shared/shopClock.ts`). The API already widens the range to whole
     * local days before calling; the day key has to be local too, or the series
     * and the range disagree about where "today" starts.
     *
     * The zone is read from the branch being reported on. For the combined view
     * (`p_branch_id is null`) there is no single branch to ask, so `business_settings`'
     * oldest row is used — Balayan's — matching the branch-less path in
     * `getShopTimeZone`. Two branches in different zones would each report their own
     * local days; both of ours are `Asia/Manila`, so the combined key is unambiguous.
     */
    'salesByDay', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', day,
        'revenue', revenue,
        'transactions', transactions
      ) order by day)
      from (
        select
          to_char(created_at at time zone (
            select time_zone from business_settings
            where p_branch_id is null or branch_id = p_branch_id
            order by created_at asc
            limit 1
          ), 'YYYY-MM-DD') as day,
          sum(total) as revenue,
          count(*) as transactions
        from sales_transactions
        where status = 'completed'
          and created_at >= p_from and created_at <= p_to
          and (p_branch_id is null or branch_id = p_branch_id)
        group by 1
      ) daily
    ), '[]'::jsonb),
    'ordersByStatus', coalesce((
      select jsonb_agg(jsonb_build_object(
        'status', status,
        'count', order_count
      ) order by status)
      from (
        select
          status,
          count(*) as order_count
        from orders
        where created_at >= p_from and created_at <= p_to
          and (p_branch_id is null or branch_id = p_branch_id)
        group by status
      ) by_status
    ), '[]'::jsonb),
    /*
     * `topItems` joins items to their parent transaction, so the branch predicate
     * lives on the *transaction* — `sales_transaction_items` deliberately has no
     * `branch_id` of its own (20261002000300_branch_scoping.sql). Scoping on the
     * joined parent is the same rule the API's list queries use.
     */
    'topItems', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', name,
        'quantity', quantity,
        'revenue', revenue
      ) order by revenue desc)
      from (
        select
          sti.name as name,
          sum(sti.quantity) as quantity,
          sum(sti.quantity * sti.unit_price) as revenue
        from sales_transaction_items sti
        inner join sales_transactions st on st.id = sti.transaction_id
        where st.status = 'completed'
          and st.created_at >= p_from
          and st.created_at <= p_to
          and (p_branch_id is null or st.branch_id = p_branch_id)
        group by sti.name
        order by sum(sti.quantity * sti.unit_price) desc
        limit 10
      ) ranked
    ), '[]'::jsonb),
    'inventoryAlerts', coalesce((
      select count(*) from inventory_items
      where stock <= reorder_level
        and (p_branch_id is null or branch_id = p_branch_id)
    ), 0)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_analytics_summary(timestamptz, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.get_analytics_summary(timestamptz, timestamptz, uuid) to service_role;
