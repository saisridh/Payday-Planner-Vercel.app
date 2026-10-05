-- Run once in Supabase SQL Editor after creating payday_plans.
-- All functions are invoker-security and executable only by the server role.
create or replace function public.claim_payday_request(p_visitor uuid, p_input jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare request_id uuid;
begin
  perform pg_advisory_xact_lock(61744091);
  if (select count(*) from public.payday_plans where created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC') >= 100 then
    return jsonb_build_object('reason','daily');
  end if;
  if (select count(*) from public.payday_plans where visitor_id = p_visitor) >= 5 then
    return jsonb_build_object('reason','visitor');
  end if;
  insert into public.payday_plans(visitor_id,input,status)
  values(p_visitor,p_input,'pending') returning id into request_id;
  return jsonb_build_object('id',request_id);
end;
$$;

create or replace function public.payday_stats()
returns jsonb language sql security invoker set search_path = public as $$
  select jsonb_build_object(
    'plans_generated', count(*),
    'sample_size', count(*),
    'average_saving_share', coalesce(round(avg(
      (input->>'amount_to_save')::numeric / nullif((input->>'take_home_pay')::numeric,0) * 100
    ),1),0)
  ) from public.payday_plans where status = 'ok';
$$;

revoke execute on function public.claim_payday_request(uuid,jsonb) from public, anon, authenticated;
revoke execute on function public.payday_stats() from public, anon, authenticated;
grant execute on function public.claim_payday_request(uuid,jsonb) to service_role;
grant execute on function public.payday_stats() to service_role;

-- Ensure the Data API can see the added functions.
notify pgrst, 'reload schema';
