-- Fixes public.get_analytics_summary, which has raised an error on every call
-- since it was introduced.
--
-- Two separate faults, found one after the other:
--
-- 1. Two `order by` clauses inside `jsonb_agg` referenced the *output* keys of
--    the object being built ('date' and 'revenue') instead of the source
--    expressions. Inside an aggregate's ORDER BY, only the underlying query's
--    columns and expressions are in scope, so both raised `column "date" does
--    not exist`.
--
-- 2. `ordersByStatus` called `count(*)` directly inside `jsonb_agg`, which
--    Postgres rejects outright with `aggregate function calls cannot be nested`.
--    The count now happens in a subquery and is passed in as a plain column,
--    matching how `salesByDay` and `topItems` were already written.
--
-- Either fault on its own was enough to fail the whole function. The API caught
-- the failure and silently fell back to client-side aggregation, which is why the
-- Analytics page still rendered while this function never once succeeded — and
-- why fault 2 stayed hidden until fault 1 was fixed and the function could get
-- far enough to hit it.

create or replace function public.get_analytics_summary(
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'revenue', coalesce((
      select sum(total) from sales_transactions
      where status = 'completed' and created_at >= p_from and created_at <= p_to
    ), 0),
    'transactionCount', coalesce((
      select count(*) from sales_transactions
      where status = 'completed' and created_at >= p_from and created_at <= p_to
    ), 0),
    'orderCount', coalesce((
      select count(*) from orders
      where created_at >= p_from and created_at <= p_to
    ), 0),
    'salesByDay', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', day,
        'revenue', revenue,
        'transactions', transactions
      ) order by day)
      from (
        select
          to_char(created_at, 'YYYY-MM-DD') as day,
          sum(total) as revenue,
          count(*) as transactions
        from sales_transactions
        where status = 'completed' and created_at >= p_from and created_at <= p_to
        group by to_char(created_at, 'YYYY-MM-DD')
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
        group by status
      ) by_status
    ), '[]'::jsonb),
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
        group by sti.name
        order by sum(sti.quantity * sti.unit_price) desc
        limit 10
      ) ranked
    ), '[]'::jsonb),
    'inventoryAlerts', coalesce((
      select count(*) from inventory_items
      where stock <= reorder_level
    ), 0)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_analytics_summary(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.get_analytics_summary(timestamptz, timestamptz) to service_role;
