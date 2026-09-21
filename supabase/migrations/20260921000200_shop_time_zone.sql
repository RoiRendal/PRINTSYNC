-- Calendar dates become shop-local instead of UTC.
--
-- Every timestamp in this schema is `timestamptz`, and the API hands it to the
-- browser as a UTC ISO string. Two things then ask the wrong question:
--
--   * Display code sliced the first ten characters off that string, which answers
--     "what date is it in UTC?" — so for a UTC+8 shop a sale rung up at 07:30 on
--     Tuesday read back as Monday.
--   * `get_analytics_summary` grouped with `to_char(created_at, 'YYYY-MM-DD')`,
--     which is the same UTC slice. One business morning was split across two
--     buckets, and a range of `2026-09-01..2026-09-30` covered
--     2026-09-01T00:00Z..2026-09-30T23:59Z — eight hours of the wrong day at each
--     end.
--
-- The effect was that every sale made before 08:00 local was reported on the
-- previous day: the whole morning shift, every day.
--
-- This migration adds the zone the dates should be derived in, and rewrites the
-- analytics function to group through it. `at time zone` is the SQL half of the
-- fix; `backend/src/shared/shopClock.ts` is the Node half, and the two are kept in
-- step by reading the same column.

alter table public.business_settings
  add column if not exists time_zone text not null default 'Asia/Manila';

-- A blank zone would make `at time zone` raise, which would take the analytics
-- endpoint down rather than degrade it. The API validates against the IANA list
-- before writing, so this only guards against a hand-edited row.
alter table public.business_settings
  drop constraint if exists business_settings_time_zone_not_blank;
alter table public.business_settings
  add constraint business_settings_time_zone_not_blank check (length(trim(time_zone)) > 0);

comment on column public.business_settings.time_zone is
  'IANA zone the business operates in. All calendar dates (order dates, the analytics daily series, export filenames) are derived in this zone, never in UTC.';

-- Same parameter list as before, so this *replaces* the function rather than
-- adding an overload. (Changing a parameter list here is what produced the stale
-- overloads cleaned up in 20260921000100.)
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
  shop_tz text;
begin
  -- Read once. `coalesce` twice: the first handles a blank column, the second
  -- handles the settings row being absent entirely. A missing configuration
  -- should not be able to break the dashboard.
  select coalesce(nullif(trim(time_zone), ''), 'Asia/Manila') into shop_tz
  from business_settings
  where id = 1;
  shop_tz := coalesce(shop_tz, 'Asia/Manila');

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
    -- The only change to the payload: `day` is the shop-local calendar date
    -- rather than the UTC one. It still serialises as a `YYYY-MM-DD` string, so
    -- the shape the API returns is unchanged.
    'salesByDay', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', day,
        'revenue', revenue,
        'transactions', transactions
      ) order by day)
      from (
        select
          (created_at at time zone shop_tz)::date as day,
          sum(total) as revenue,
          count(*) as transactions
        from sales_transactions
        where status = 'completed' and created_at >= p_from and created_at <= p_to
        group by (created_at at time zone shop_tz)::date
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
