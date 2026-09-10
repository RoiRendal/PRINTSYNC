insert into public.permissions (key, description)
values ('audit.read', 'View audit log events')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
join public.permissions on permissions.key = 'audit.read'
where roles.name = 'admin'
on conflict do nothing;