alter table public.orders add column if not exists customer_id uuid references public.customers(id) on delete set null;
alter table public.orders add column if not exists due_date date;

create index orders_customer_idx on public.orders(customer_id);
create index orders_due_date_idx on public.orders(due_date);
