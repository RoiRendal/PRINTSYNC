create table public.operating_expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null check (length(btrim(category)) > 0),
  description text not null default '',
  amount numeric(12, 2) not null check (amount >= 0),
  expense_date date not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index operating_expenses_date_idx on public.operating_expenses(expense_date desc);
create index operating_expenses_category_idx on public.operating_expenses(category);

alter table public.operating_expenses enable row level security;

create policy "authenticated users can read operating expenses"
on public.operating_expenses for select
to authenticated
using (true);

grant select on public.operating_expenses to authenticated;
grant select, insert, update, delete on public.operating_expenses to service_role;
