insert into public.permissions (key, description)
values ('settings.read', 'View business settings and branding')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
join public.permissions on permissions.key = 'settings.read'
where roles.name in ('admin', 'staff')
on conflict do nothing;

create table public.business_settings (
  id integer primary key default 1 check (id = 1),
  business_name text not null default 'IC Printing Services' check (length(btrim(business_name)) > 0),
  logo_url text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger business_settings_set_updated_at
before update on public.business_settings
for each row execute function public.set_updated_at();

insert into public.business_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.business_settings enable row level security;

create policy "authenticated users can read business settings"
on public.business_settings for select
to authenticated
using (true);

grant select on public.business_settings to authenticated;
grant select, insert, update, delete on public.business_settings to service_role;