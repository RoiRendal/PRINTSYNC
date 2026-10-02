-- Add the Workspace's stock totals to the summary it already fetches.
--
-- The Dashboard gains Inventory's two totals — Total Stock and Stock Value —
-- because those number cards move off the Inventory page (see the Dashboard's
-- own note). They ride on `get_orders_summary` for the same reason `lowStock`
-- already does: the Workspace's cards are one screen fetched in one round trip,
-- and a second request would only give the page two ways to disagree with
-- itself. Keeping the whole row on one payload is what lets the page show one
-- coherent snapshot.
--
-- ## The payload changes; the signature does not
--
-- The function returns `jsonb`, so adding keys is not a signature change and
-- `create or replace` is enough. There is no `drop` here and no second overload
-- left behind — the parameter list is unchanged from
-- 20261002000500_orders_summary_branch.sql, which is the trap
-- 20260921000100_drop_stale_order_rpc_overloads.sql exists to clean up.
--
-- ## Both totals are branch-scoped, and summed over the whole table
--
-- The Inventory page computed these in the browser from page 1 of a 20-row
-- list, so they under-reported the moment the catalogue passed 20 items — the
-- same defect that put the order counts in the database. These are summed over
-- every item in the caller's branch, which is what a total is supposed to mean.
--
-- `totalValue` is `stock * price`, matching the Inventory page's own definition
-- — a stock valuation, not revenue. It is the first money figure on the
-- Workspace, and that is deliberate: the old rule, "counts work waiting, not
-- money", was aimed at revenue, which carries a date range. A valuation is a
-- snapshot with no period, so the screen can stand behind it.
--
-- `coalesce` matters: an empty branch has no rows to sum, and a card must render
-- `0` rather than `null`.

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
    ),
    'totalStock', (
      select coalesce(sum(stock), 0) from inventory_items
      where branch_id = p_branch_id
    ),
    'totalValue', (
      select coalesce(sum(stock * price), 0) from inventory_items
      where branch_id = p_branch_id
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_orders_summary(uuid) from public, anon, authenticated;
grant execute on function public.get_orders_summary(uuid) to service_role;
