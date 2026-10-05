-- Run this complete script in Supabase SQL Editor.
-- Preserves payday_plans and existing registration dates.
begin;
create table if not exists public.payday_registrations (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null unique,
  created_at timestamptz not null default now(),
  name text not null check(char_length(name) between 1 and 100),
  email text not null check(char_length(email) between 3 and 254),
  consent_version text not null default 'six-month-access-v1'
);
alter table public.payday_registrations enable row level security;
revoke all on public.payday_registrations from anon, authenticated;
grant select, insert on public.payday_registrations to service_role;

create or replace function public.payday_access(p_visitor uuid)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare registration_date timestamptz; successful boolean; attempts bigint; member_attempts bigint;
begin
  select created_at into registration_date from public.payday_registrations where visitor_id=p_visitor;
  select exists(select 1 from public.payday_plans where visitor_id=p_visitor and status='ok') into successful;
  select count(*) into attempts from public.payday_plans where visitor_id=p_visitor;
  if registration_date is not null then
    select count(*) into member_attempts from public.payday_plans
      where visitor_id=p_visitor and created_at>=greatest(registration_date,date_trunc('day',now() at time zone 'UTC') at time zone 'UTC');
    return jsonb_build_object('registered',true,'registered_at',registration_date,
      'payment_due_at',registration_date+interval '6 months','free_year_ends_at',registration_date+interval '1 year',
      'payment_required',now()>=registration_date+interval '6 months',
      'daily_limit_reached',member_attempts>=5,'requests_remaining_today',greatest(0,5-member_attempts),
      'used',successful,'retry_limit_reached',false);
  end if;
  return jsonb_build_object('registered',false,'used',successful,'retry_limit_reached',attempts>=5,'payment_required',false,'daily_limit_reached',false);
end;
$$;

create or replace function public.register_payday_visitor(p_visitor uuid,p_name text,p_email text)
returns jsonb language plpgsql security invoker set search_path = public as $$
begin
  perform pg_advisory_xact_lock(61744091);
  if not exists(select 1 from public.payday_registrations where visitor_id=p_visitor) then
    if (select count(*) from public.payday_registrations where created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=100 then
      return jsonb_build_object('error','Registration has reached its daily limit. Please try tomorrow.');
    end if;
    insert into public.payday_registrations(visitor_id,name,email) values(p_visitor,p_name,p_email);
  end if;
  return public.payday_access(p_visitor);
end;
$$;

create or replace function public.claim_payday_request(p_visitor uuid,p_input jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare request_id uuid; access jsonb;
begin
  perform pg_advisory_xact_lock(61744091);
  access:=public.payday_access(p_visitor);
  if (access->>'payment_required')::boolean then return jsonb_build_object('reason','payment'); end if;
  if (access->>'registered')::boolean then
    if (access->>'daily_limit_reached')::boolean then return jsonb_build_object('reason','member_daily'); end if;
  else
    if (access->>'used')::boolean then return jsonb_build_object('reason','signup'); end if;
    if (access->>'retry_limit_reached')::boolean then return jsonb_build_object('reason','visitor'); end if;
  end if;
  if (select count(*) from public.payday_plans where created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=100 then
    return jsonb_build_object('reason','daily');
  end if;
  if exists(select 1 from public.payday_plans where visitor_id=p_visitor and status='pending' and created_at>now()-interval '45 seconds') then
    return jsonb_build_object('reason','pending');
  end if;
  insert into public.payday_plans(visitor_id,input,status) values(p_visitor,p_input,'pending') returning id into request_id;
  return jsonb_build_object('id',request_id);
end;
$$;

create or replace function public.payday_stats()
returns jsonb language sql security invoker set search_path = public as $$
 select jsonb_build_object('plans_generated',count(*),'sample_size',count(*),
 'average_saving_share',coalesce(round(avg((input->>'amount_to_save')::numeric/nullif((input->>'take_home_pay')::numeric,0)*100),1),0))
 from public.payday_plans where status='ok';
$$;
revoke execute on function public.payday_access(uuid) from public,anon,authenticated;
revoke execute on function public.register_payday_visitor(uuid,text,text) from public,anon,authenticated;
revoke execute on function public.claim_payday_request(uuid,jsonb) from public,anon,authenticated;
revoke execute on function public.payday_stats() from public,anon,authenticated;
grant execute on function public.payday_access(uuid) to service_role;
grant execute on function public.register_payday_visitor(uuid,text,text) to service_role;
grant execute on function public.claim_payday_request(uuid,jsonb) to service_role;
grant execute on function public.payday_stats() to service_role;
notify pgrst,'reload schema';
commit;
