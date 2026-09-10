grant usage on schema public to authenticated, service_role;

grant select on public.roles, public.permissions, public.role_permissions to authenticated;
grant select on public.profiles to authenticated;
grant select on public.audit_logs to authenticated;

grant select, insert, update, delete on public.roles to service_role;
grant select, insert, update, delete on public.permissions to service_role;
grant select, insert, update, delete on public.role_permissions to service_role;
grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.audit_logs to service_role;