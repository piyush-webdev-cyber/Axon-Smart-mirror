-- Run once in Supabase Dashboard → SQL Editor
-- Fixes: "Could not find the table public.device_codes" (PGRST205)
-- Required for phone linking via https://axon-smart-mirror.vercel.app/link/...

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.device_codes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid,
  code         text not null unique,
  status       text not null default 'pending',
  mirror_token text,
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- If device_codes existed before Phase 5, ensure mirror_token column is present
alter table public.device_codes
  add column if not exists mirror_token text;

create index if not exists idx_device_codes_user_id
  on public.device_codes (user_id);

create unique index if not exists idx_device_codes_mirror_token
  on public.device_codes (mirror_token)
  where mirror_token is not null;

drop trigger if exists trg_device_codes_updated_at on public.device_codes;
create trigger trg_device_codes_updated_at
  before update on public.device_codes
  for each row execute function public.set_updated_at();

alter table public.device_codes enable row level security;
alter table public.device_codes replica identity full;

drop policy if exists "device_codes_select_own" on public.device_codes;
create policy "device_codes_select_own" on public.device_codes
  for select using (auth.uid() = user_id);

drop policy if exists "device_codes_modify_own" on public.device_codes;
create policy "device_codes_modify_own" on public.device_codes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "device_codes_anon_select_for_linking" on public.device_codes;
create policy "device_codes_anon_select_for_linking"
  on public.device_codes
  for select
  to anon
  using (status in ('pending', 'linked'));

-- Enable Realtime: Dashboard → Database → Replication → device_codes
