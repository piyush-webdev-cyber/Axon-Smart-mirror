-- ============================================================================
-- Axon - Migration 0005: Phase 5 Camera, Gallery & QR Transfer
-- ============================================================================

-- Photo metadata columns
alter table public.photos
  add column if not exists file_name text,
  add column if not exists file_size bigint,
  add column if not exists width integer,
  add column if not exists height integer;

-- Mirror device token (issued when a device code is linked)
alter table public.device_codes
  add column if not exists mirror_token text;

create unique index if not exists idx_device_codes_mirror_token
  on public.device_codes (mirror_token)
  where mirror_token is not null;

-- Temporary gallery sessions for QR phone access
create table if not exists public.gallery_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  token      text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_gallery_sessions_user_id
  on public.gallery_sessions (user_id);

create index if not exists idx_gallery_sessions_token
  on public.gallery_sessions (token);

create index if not exists idx_gallery_sessions_expires_at
  on public.gallery_sessions (expires_at);

alter table public.gallery_sessions enable row level security;

create policy "gallery_sessions_select_own" on public.gallery_sessions
  for select using (auth.uid() = user_id);

create policy "gallery_sessions_insert_own" on public.gallery_sessions
  for insert with check (auth.uid() = user_id);

create policy "gallery_sessions_delete_own" on public.gallery_sessions
  for delete using (auth.uid() = user_id);
