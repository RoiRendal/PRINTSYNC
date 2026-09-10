create or replace function public.write_audit_log(
  p_actor_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_metadata jsonb,
  p_ip_address inet,
  p_user_agent text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata,
    ip_address,
    user_agent
  )
  values (
    p_actor_id,
    p_action,
    p_entity_type,
    p_entity_id,
    coalesce(p_metadata, '{}'::jsonb),
    p_ip_address,
    p_user_agent
  );
end;
$$;

revoke all on function public.write_audit_log(uuid, text, text, text, jsonb, inet, text) from public, anon, authenticated;
grant execute on function public.write_audit_log(uuid, text, text, text, jsonb, inet, text) to service_role;