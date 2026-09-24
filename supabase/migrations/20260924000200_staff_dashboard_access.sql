-- Grants staff `dashboard.read`, so the Dashboard stops being an admin-only page.
--
-- Staff land on /orders today because STAFF_PAGE_ACCESS does not list `dashboard`
-- and staff were never granted `dashboard.read`. Both halves are needed: the
-- permission flips what the session payload reports, and the frontend constant
-- clamps what the sidebar will show. Change either one alone and the page stays
-- invisible, which is why this is a database change and not just a frontend one.
--
-- `on conflict do nothing` because role_permissions is keyed (role_id,
-- permission_id) and this migration may be replayed against a database that has
-- already been granted it.

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
join public.permissions on permissions.key = 'dashboard.read'
where roles.name = 'staff'
on conflict do nothing;
