insert into public.permissions (key, description)
values
  ('customers.read', 'View customers'),
  ('customers.manage', 'Manage customers'),
  ('order_payments.read', 'View order payments'),
  ('order_payments.create', 'Record order payments'),
  ('suppliers.read', 'View suppliers'),
  ('suppliers.manage', 'Manage suppliers'),
  ('expenses.read', 'View expenses'),
  ('expenses.manage', 'Manage expenses')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
join public.permissions on permissions.key in (
  'customers.read',
  'order_payments.read',
  'order_payments.create',
  'inventory.read',
  'designs.read'
)
where roles.name = 'staff'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
join public.permissions on permissions.key in (
  'customers.read',
  'customers.manage',
  'order_payments.read',
  'order_payments.create',
  'suppliers.read',
  'suppliers.manage',
  'expenses.read',
  'expenses.manage'
)
where roles.name = 'admin'
on conflict do nothing;
