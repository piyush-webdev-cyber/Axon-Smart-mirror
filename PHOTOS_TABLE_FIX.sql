-- Run in Supabase Dashboard -> SQL Editor (fixes GET /photos 500)
-- Creates photos table + gallery sessions if missing.

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

create table if not exists public.photos (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  storage_path   text not null,
  thumbnail_path text,
  caption        text,
  metadata       jsonb not null default '{}'::jsonb,
  file_name      text,
  file_size      bigint,
  width          integer,
  height         integer,
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

alter table public.photos enable row level security;

drop policy if exists "photos_select_own" on public.photos;
create policy "photos_select_own" on public.photos
  for select using (auth.uid() = user_id);

drop policy if exists "photos_modify_own" on public.photos;
create policy "photos_modify_own" on public.photos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Gallery QR sessions (Phase 5)
create table if not exists public.gallery_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  token      text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_gallery_sessions_token on public.gallery_sessions (token);

alter table public.gallery_sessions enable row level security;

drop policy if exists "gallery_sessions_select_own" on public.gallery_sessions;
create policy "gallery_sessions_select_own" on public.gallery_sessions
  for select using (auth.uid() = user_id);

drop policy if exists "gallery_sessions_insert_own" on public.gallery_sessions;
create policy "gallery_sessions_insert_own" on public.gallery_sessions
  for insert with check (auth.uid() = user_id);

drop policy if exists "gallery_sessions_delete_own" on public.gallery_sessions;
create policy "gallery_sessions_delete_own" on public.gallery_sessions
  for delete using (auth.uid() = user_id);

-- Storage bucket (private) — skip if already exists
insert into storage.buckets (id, name, public)
values ('axon-media', 'axon-media', false)
on conflict (id) do nothing;
