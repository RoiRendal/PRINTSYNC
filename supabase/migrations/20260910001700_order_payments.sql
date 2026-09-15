create table public.order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  method text not null check (method in ('Cash', 'Card', 'Other')),
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index order_payments_order_idx on public.order_payments(order_id, created_at desc);

alter table public.order_payments enable row level security;

create policy "authenticated users can read order payments"
on public.order_payments for select
to authenticated
using (true);

grant select on public.order_payments to authenticated;
grant select, insert, update, delete on public.order_payments to service_role;
