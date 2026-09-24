-- Adds public.get_orders_summary(): the counts the Workspace number cards show.
--
-- Why a function and not a query from the API: the Dashboard computed these in the
-- browser from page 1 of a 20-row list, so "Active Orders" silently under-reported
-- and "Today's Revenue" read 0 beside orders carrying real values. Counting in the
-- database is the only way the number is true for the whole table rather than for
-- whatever page happened to load.
--
-- No parameters, deliberately. A summary of "every order, by status" has nothing to
-- be scoped by — and a parameter added later would create a *second overload*
-- rather than replacing this one, which is exactly how stale RPC signatures have
-- accumulated in this schema before.
--
-- Two rules the payload keeps, both of which the UI depends on:
--
--   1. `byStatus` is zero-filled. All six statuses always appear, carrying 0 when
--      empty, because a card that vanishes from the page when nobody is in that
--      status is worse than a card reading 0.
--
--   2. `total` equals the sum of `byStatus`. `orders.status` carries a CHECK
--      constraint restricting it to these six today, so the invariant cannot be
--      broken by data — but the six are unioned with whatever is actually present
--      rather than taken as given, so relaxing that constraint later cannot make
--      the page's own numbers disagree with each other. Unknowns sort last.

create or replace function public.get_orders_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
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
    group by status
  ),
  -- Union on status alone, so a known status is not duplicated by its own count.
  every_status as (
    select status from known
    union
    select status from counted
  )
  select jsonb_build_object(
    'total', (select count(*) from orders),
    'open', (
      select count(*) from orders
      where status not in ('Completed', 'Delivered')
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
      where stock <= reorder_level
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_orders_summary() from public, anon, authenticated;
grant execute on function public.get_orders_summary() to service_role;
