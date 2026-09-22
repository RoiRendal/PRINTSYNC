-- The audit row learns which request wrote it.
--
-- An audit row already says who (actor_id) and what (action, entity_type,
-- entity_id). It could not say *which request* — so when a shop reports "the
-- system did something strange at 2pm", the row and the server logs describing it
-- had no shared identifier, and correlating them meant guessing from timestamps.
--
-- `p_request_id` closes that. It is merged into `metadata` rather than given a
-- column of its own: `metadata` is already the place for per-action context, the
-- column set stays as it is, and the id is read by humans chasing one incident
-- rather than queried in bulk. A dedicated column would mean a new index and a
-- wider table for a value nothing filters on.
--
-- `default null` is deliberate and load-bearing for a rolling deploy: the API
-- sends eight named arguments now, but a backend still running the previous
-- version sends seven, and that call has to keep working until the old instances
-- are gone. The old seven-argument function is dropped rather than left in place,
-- because `create or replace` with an added parameter would create a *second*
-- overload and make a seven-argument call ambiguous — the same trap that produced
-- the stale overloads cleaned up in 20260921000100.

drop function if exists public.write_audit_log(uuid, text, text, text, jsonb, inet, text);

create or replace function public.write_audit_log(
  p_actor_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_metadata jsonb,
  p_ip_address inet,
  p_user_agent text,
  p_request_id text default null
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
    -- Merged only when there is something to merge. Writing
    -- `"requestId": null` into every row written outside a request would be noise
    -- that looks like a failed lookup rather than an absent one.
    --
    -- A blank string is treated as absent for the same reason. The API already
    -- sends null rather than '', but this function is also called from the money
    -- RPCs, and one of them should not be able to write an empty id by accident.
    case
      when p_request_id is null or length(btrim(p_request_id)) = 0
        then coalesce(p_metadata, '{}'::jsonb)
      else coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('requestId', btrim(p_request_id))
    end,
    p_ip_address,
    p_user_agent
  );
end;
$$;

-- A new signature is executable by PUBLIC by default, so the grants are restated
-- for it. `drop function` took the previous grants with it.
revoke all on function public.write_audit_log(uuid, text, text, text, jsonb, inet, text, text)
  from public, anon, authenticated;

grant execute on function public.write_audit_log(uuid, text, text, text, jsonb, inet, text, text)
  to service_role;
