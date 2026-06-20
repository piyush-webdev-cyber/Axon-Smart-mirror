-- ============================================================================
-- Axon - Migration 0002: core schema
-- ============================================================================
-- Phase 1 actively uses `profiles` and `settings`. The remaining tables are
-- created now (with relationships + indexes) so future phases - photos, face
-- recognition, InterviewGPT, coach goals, music, device linking - drop in
-- without migrations that touch existing data.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles - 1:1 with auth.users (the public-facing user record)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Fire the auto-provisioning trigger now that profiles/settings exist.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- settings - 1:1 with profiles (theme + JSON preferences)
-- ----------------------------------------------------------------------------
create table if not exists public.settings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references public.profiles (id) on delete cascade,
  theme       text not null default 'black-mirror',
  preferences jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_settings_user_id on public.settings (user_id);

create trigger trg_settings_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- photos - future: photo capture + QR sharing
-- ----------------------------------------------------------------------------
create table if not exists public.photos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  caption      text,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index if not exists idx_photos_user_id on public.photos (user_id);
create index if not exists idx_photos_created_at on public.photos (created_at desc);

create trigger trg_photos_updated_at
  before update on public.photos
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- interviews - future: InterviewGPT sessions
-- ----------------------------------------------------------------------------
create table if not exists public.interviews (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  title      text,
  status     text not null default 'created',
  transcript jsonb not null default '[]'::jsonb,
  feedback   jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_interviews_user_id on public.interviews (user_id);

create trigger trg_interviews_updated_at
  before update on public.interviews
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- conversations - future: voice assistant + daily coach chat history
-- ----------------------------------------------------------------------------
create table if not exists public.conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  title      text,
  messages   jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_conversations_user_id on public.conversations (user_id);

create trigger trg_conversations_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- face_profiles - future: face recognition enrollments
-- ----------------------------------------------------------------------------
create table if not exists public.face_profiles (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  label          text,
  embeddings_ref text,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_face_profiles_user_id on public.face_profiles (user_id);

create trigger trg_face_profiles_updated_at
  before update on public.face_profiles
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- goals - future: daily AI coach goals/habits
-- ----------------------------------------------------------------------------
create table if not exists public.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  title       text not null,
  description text,
  status      text not null default 'active',
  due_date    date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_goals_user_id on public.goals (user_id);
create index if not exists idx_goals_status on public.goals (status);

create trigger trg_goals_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- device_codes - future: linking a physical mirror to a user account
-- user_id is nullable until a pending code is claimed by an account.
-- ----------------------------------------------------------------------------
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

create trigger trg_device_codes_updated_at
  before update on public.device_codes
  for each row execute function public.set_updated_at();
