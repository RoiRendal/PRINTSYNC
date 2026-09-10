create extension if not exists "pgcrypto";

create type public.app_role as enum ('admin', 'staff');

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name public.app_role not null unique,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text not null default '',
  created_at timestamptz not null default now(),
  constraint permissions_key_format check (key ~ '^[a-z][a-z0-9_.-]*$')
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  phone text not null default '',
  position text not null default '',
  role_id uuid not null references public.roles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_name_not_blank check (length(btrim(name)) > 0)
);

create index role_permissions_permission_id_idx on public.role_permissions(permission_id);
create index profiles_role_id_idx on public.profiles(role_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

insert into public.roles (name, description)
values
  ('admin', 'Full system administration access'),
  ('staff', 'Operational access for orders and point of sale')
on conflict (name) do nothing;

insert into public.permissions (key, description)
values
  ('dashboard.read', 'View dashboard metrics'),
  ('orders.read', 'View orders'),
  ('orders.create', 'Create orders'),
  ('orders.update', 'Update order status and details'),
  ('orders.delete', 'Delete orders'),
  ('inventory.read', 'View inventory'),
  ('inventory.manage', 'Create, update, and delete inventory items'),
  ('designs.read', 'View designs'),
  ('designs.manage', 'Create, update, and delete designs'),
  ('analytics.read', 'View analytics'),
  ('users.read', 'View users'),
  ('users.manage', 'Manage users and roles'),
  ('settings.manage', 'Manage business settings')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
cross join public.permissions
where roles.name = 'admin'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
join public.permissions
  on permissions.key in (
    'orders.read',
    'orders.create',
    'orders.update',
    'inventory.read',
    'designs.read'
  )
where roles.name = 'staff'
on conflict do nothing;

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profiles enable row level security;

create policy "authenticated users can read roles"
on public.roles for select
to authenticated
using (true);

create policy "authenticated users can read permissions"
on public.permissions for select
to authenticated
using (true);

create policy "authenticated users can read role permissions"
on public.role_permissions for select
to authenticated
using (true);

create policy "users can read their own profile"
on public.profiles for select
to authenticated
using (auth.uid() = id);
