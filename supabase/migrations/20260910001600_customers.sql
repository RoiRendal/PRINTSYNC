create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  phone text not null default '',
  email text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customers_name_idx on public.customers using gin(to_tsvector('simple', name));

create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

alter table public.customers enable row level security;

create policy "authenticated users can read customers"
on public.customers for select
to authenticated
using (true);

grant select on public.customers to authenticated;
grant select, insert, update, delete on public.customers to service_role;
