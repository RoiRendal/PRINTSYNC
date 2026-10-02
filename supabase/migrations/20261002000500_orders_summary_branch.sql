-- Scope the Workspace's order counts to a branch.
--
-- `get_orders_summary()` was written with **no parameters, deliberately** — see
-- 20260924000100_orders_summary.sql: "a summary of 'every order, by status' has
-- nothing to be scoped by". That was true for one shop and is false for two. The
-- Workspace is inside a branch, so a Balayan cashier must see Balayan's queue
-- count and Balayan's low-stock count, not the two shops added together.
--
-- ## The signature changes, so the old function must be dropped first
--
-- `create or replace` with a different parameter list leaves the previous arity
-- behind as a second overload — the trap `20260921000100_drop_stale_order_rpc_overloads.sql`
-- was written to clean up. The zero-argument version is dropped explicitly here.
--
-- ## What stays the same
--
-- The payload keeps both of its published rules, because the Workspace depends on
-- them and they are branch-independent:
--
--   1. `byStatus` is zero-filled — all six statuses always appear, carrying 0 when
--      empty, so a card never vanishes from the page.
--   2. `total` equals the sum of `byStatus`.
--
-- Only the `where` clauses change: `orders`, `inventory_items` and the two counts
-- are each narrowed to `p_branch_id`.

drop function if exists public.get_orders_summary();

create or replace function public.get_orders_summary(
  p_branch_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if p_branch_id is null then
    raise exception 'A branch is required to summarise orders';
  end if;

  with known(status, sort_order) as (
    values
      ('Pending', 1),
      ('Designing', 2),
      ('In Production', 3),
      ('Ready for Pickup', 4),
      ('Completed', 5),
      ('Delivered', 6)
  ),
  counted as (
    select status, count(*) as order_count
    from orders
    where branch_id = p_branch_id
    group by status
  ),
  -- Union on status alone, so a known status is not duplicated by its own count.
  every_status as (
    select status from known
    union
    select status from counted
  )
  select jsonb_build_object(
    'total', (select count(*) from orders where branch_id = p_branch_id),
    'open', (
      select count(*) from orders
      where branch_id = p_branch_id
        and status not in ('Completed', 'Delivered')
    ),
    'byStatus', coalesce((
      select jsonb_agg(
        jsonb_build_object('status', es.status, 'count', coalesce(c.order_count, 0))
        order by coalesce(k.sort_order, 999), es.status
      )
      from every_status es
      left join known k on k.status = es.status
      left join counted c on c.status = es.status
    ), '[]'::jsonb),
    'lowStock', (
      select count(*) from inventory_items
      where branch_id = p_branch_id
        and stock <= reorder_level
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_orders_summary(uuid) from public, anon, authenticated;
grant execute on function public.get_orders_summary(uuid) to service_role;
