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
  created_at timestamptz not null default now()
);
create index if not exists runners_name_idx on public.runners using gin (to_tsvector('simple', name));
alter table public.runners enable row level security;
create policy "event staff read" on public.runners for select using (true);
create policy "event staff insert" on public.runners for insert with check (true);
create policy "event staff update" on public.runners for update using (true) with check (true);
alter publication supabase_realtime add table public.runners;
