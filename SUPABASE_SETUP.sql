-- Axon Supabase bootstrap — run once in Supabase Dashboard -> SQL Editor
-- Creates core tables required for QR device linking (Phase 3)

create extension if not exists pgcrypto;

-- Shared trigger helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Profiles (1:1 with auth.users)
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Settings
create table if not exists public.settings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references public.profiles (id) on delete cascade,
  theme       text not null default 'black-mirror',
  preferences jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_settings_user_id on public.settings (user_id);

drop trigger if exists trg_settings_updated_at on public.settings;
create trigger trg_settings_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

-- Auto-provision profile + settings on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Device codes (QR linking)
create table if not exists public.device_codes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles (id) on delete cascade,
  code       text not null unique,
  status     text not null default 'pending',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_device_codes_user_id on public.device_codes (user_id);

drop trigger if exists trg_device_codes_updated_at on public.device_codes;
create trigger trg_device_codes_updated_at
  before update on public.device_codes
  for each row execute function public.set_updated_at();

-- Photos (Phase 3 camera/gallery)
create table if not exists public.photos (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  storage_path   text not null,
  thumbnail_path text,
  caption        text,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create index if not exists idx_photos_user_id on public.photos (user_id);
create index if not exists idx_photos_created_at on public.photos (created_at desc);
create index if not exists idx_photos_deleted_at on public.photos (deleted_at) where deleted_at is null;

drop trigger if exists trg_photos_updated_at on public.photos;
create trigger trg_photos_updated_at
  before update on public.photos
  for each row execute function public.set_updated_at();

-- Row Level Security
alter table public.profiles      enable row level security;
alter table public.settings      enable row level security;
alter table public.device_codes  enable row level security;
alter table public.photos        enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "settings_select_own" on public.settings;
create policy "settings_select_own" on public.settings
  for select using (auth.uid() = user_id);

drop policy if exists "settings_modify_own" on public.settings;
create policy "settings_modify_own" on public.settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "device_codes_select_own" on public.device_codes;
create policy "device_codes_select_own" on public.device_codes
  for select using (auth.uid() = user_id);

drop policy if exists "device_codes_modify_own" on public.device_codes;
create policy "device_codes_modify_own" on public.device_codes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "photos_select_own" on public.photos;
create policy "photos_select_own" on public.photos
  for select using (auth.uid() = user_id);

drop policy if exists "photos_modify_own" on public.photos;
create policy "photos_modify_own" on public.photos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';
