alter table public.orders add column if not exists customer_id uuid references public.customers(id) on delete set null;
alter table public.orders add column if not exists due_date date;

-- Renamed from `orders_customer_idx`, which 20260910001000_orders.sql had already taken for a GIN
-- index on customer. See 20260921000000_fix_orders_customer_index.sql.
create index if not exists orders_customer_id_idx on public.orders(customer_id);
create index orders_due_date_idx on public.orders(due_date);
