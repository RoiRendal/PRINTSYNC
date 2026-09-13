-- SQL RPC function for analytics summary aggregation
-- Moves all aggregation logic from Node.js to PostgreSQL for better performance at scale

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
        'date', to_char(created_at, 'YYYY-MM-DD'),
        'revenue', sum(total),
        'transactions', count(*)
      ) order by date)
      from sales_transactions
      where status = 'completed' and created_at >= p_from and created_at <= p_to
      group by to_char(created_at, 'YYYY-MM-DD')
    ), '[]'::jsonb),
    'ordersByStatus', coalesce((
      select jsonb_agg(jsonb_build_object(
        'status', status,
        'count', count(*)
      ) order by status)
      from orders
      where created_at >= p_from and created_at <= p_to
      group by status
    ), '[]'::jsonb),
    'topItems', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', sti.name,
        'quantity', sum(sti.quantity),
        'revenue', sum(sti.quantity * sti.unit_price)
      ) order by revenue desc)
      from sales_transaction_items sti
      inner join sales_transactions st on st.id = sti.transaction_id
      where st.status = 'completed'
        and st.created_at >= p_from
        and st.created_at <= p_to
      group by sti.name
      limit 10
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
