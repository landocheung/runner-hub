-- Runner Hub production schema (reference copy).
-- Existing production project has been migrated separately.
create extension if not exists pgcrypto;

create table if not exists public.runners (
  id uuid primary key default gen_random_uuid(),
  bib_number text not null unique,
  name text not null,
  checkin_time timestamptz,
  massage_status text not null default 'not_requested' check (massage_status in ('not_requested','waiting','skipped','in_service','completed','cancelled')),
  queue_joined_at timestamptz,
  massage_start_time timestamptz,
  massage_end_time timestamptz,
  therapist text,
  skip_count integer not null default 0,
  interview_interest boolean not null default false,
  interview_status text not null default 'not_interested' check (interview_status in ('not_interested','available','contacted','in_interview','completed','skipped')),
  interview_joined_at timestamptz,
  interview_contacted_at timestamptz,
  interview_start_time timestamptz,
  interview_end_time timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists runners_queue_idx on public.runners (massage_status, queue_joined_at);
create index if not exists runners_interview_queue_idx on public.runners (interview_status, interview_joined_at);

create table if not exists public.event_settings (
  id text primary key,
  logo_data_url text,
  updated_at timestamptz not null default now()
);

create or replace function public.claim_next_runner(p_therapist text)
returns public.runners
language plpgsql
security invoker
set search_path = public
as $$
declare v_runner public.runners;
begin
  select * into v_runner
  from public.runners
  where massage_status = 'waiting'
  order by queue_joined_at asc nulls last, created_at asc
  for update skip locked
  limit 1;
  if v_runner.id is null then return null; end if;
  update public.runners
  set massage_status='in_service', therapist=p_therapist, massage_start_time=now()
  where id=v_runner.id returning * into v_runner;
  return v_runner;
end;
$$;
