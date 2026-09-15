create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  contact_person text not null default '',
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger suppliers_set_updated_at
before update on public.suppliers
for each row execute function public.set_updated_at();

alter table public.suppliers enable row level security;

create policy "authenticated users can read suppliers"
on public.suppliers for select
to authenticated
using (true);

grant select on public.suppliers to authenticated;
grant select, insert, update, delete on public.suppliers to service_role;

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'ordered', 'received', 'cancelled')),
  total_amount numeric(12, 2) not null default 0 check (total_amount >= 0),
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index purchase_orders_supplier_idx on public.purchase_orders(supplier_id);
create index purchase_orders_status_idx on public.purchase_orders(status);

create trigger purchase_orders_set_updated_at
before update on public.purchase_orders
for each row execute function public.set_updated_at();

alter table public.purchase_orders enable row level security;

create policy "authenticated users can read purchase orders"
on public.purchase_orders for select
to authenticated
using (true);

grant select on public.purchase_orders to authenticated;
grant select, insert, update, delete on public.purchase_orders to service_role;
