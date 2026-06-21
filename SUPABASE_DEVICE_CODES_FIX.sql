-- Axon Phase 3 QR linking quick fix.
-- Run this in Supabase Dashboard -> SQL Editor.

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
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles (id) on delete cascade,
  code       text not null unique,
  status     text not null default 'pending',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_device_codes_user_id
  on public.device_codes (user_id);

drop trigger if exists trg_device_codes_updated_at on public.device_codes;
create trigger trg_device_codes_updated_at
  before update on public.device_codes
  for each row execute function public.set_updated_at();

alter table public.device_codes enable row level security;

drop policy if exists "device_codes_select_own" on public.device_codes;
create policy "device_codes_select_own" on public.device_codes
  for select using (auth.uid() = user_id);

drop policy if exists "device_codes_modify_own" on public.device_codes;
create policy "device_codes_modify_own" on public.device_codes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
