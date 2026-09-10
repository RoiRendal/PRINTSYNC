insert into public.permissions (key, description)
values ('pos.read', 'Use the point of sale workspace')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
join public.permissions
  on permissions.key = 'pos.read'
where roles.name in ('admin', 'staff')
on conflict do nothing;

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (length(btrim(action)) > 0),
  entity_type text not null check (length(btrim(entity_type)) > 0),
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index audit_logs_actor_id_idx on public.audit_logs(actor_id);
create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);
create index audit_logs_created_at_idx on public.audit_logs(created_at desc);

alter table public.audit_logs enable row level security;

create policy "admins can read audit logs"
on public.audit_logs for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    join public.roles on roles.id = profiles.role_id
    where profiles.id = auth.uid()
      and roles.name = 'admin'
  )
);