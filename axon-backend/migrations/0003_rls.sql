-- ============================================================================
-- Axon - Migration 0003: Row Level Security
-- ============================================================================
-- Security model: every row is owned by exactly one user, and a user may only
-- read/write their own rows. Enforced in the database so it holds regardless of
-- which client (mirror, phone, future services) connects.
-- ============================================================================

-- Enable RLS on all user-owned tables
alter table public.profiles      enable row level security;
alter table public.settings      enable row level security;
alter table public.photos        enable row level security;
alter table public.interviews    enable row level security;
alter table public.conversations enable row level security;
alter table public.face_profiles enable row level security;
alter table public.goals         enable row level security;
alter table public.device_codes  enable row level security;

-- ----------------------------------------------------------------------------
-- profiles: owner is the row id itself (id == auth.uid())
-- ----------------------------------------------------------------------------
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- Generic owner policies for user_id-scoped tables.
-- (Repeated per-table because Postgres policies are not parameterizable.)
-- ----------------------------------------------------------------------------

-- settings
create policy "settings_select_own" on public.settings
  for select using (auth.uid() = user_id);
create policy "settings_modify_own" on public.settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- photos
create policy "photos_select_own" on public.photos
  for select using (auth.uid() = user_id);
create policy "photos_modify_own" on public.photos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- interviews
create policy "interviews_select_own" on public.interviews
  for select using (auth.uid() = user_id);
create policy "interviews_modify_own" on public.interviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- conversations
create policy "conversations_select_own" on public.conversations
  for select using (auth.uid() = user_id);
create policy "conversations_modify_own" on public.conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- face_profiles
create policy "face_profiles_select_own" on public.face_profiles
  for select using (auth.uid() = user_id);
create policy "face_profiles_modify_own" on public.face_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- goals
create policy "goals_select_own" on public.goals
  for select using (auth.uid() = user_id);
create policy "goals_modify_own" on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- device_codes: a user sees codes already linked to them. Unclaimed-code
-- creation/claiming is handled server-side via the service role (bypasses RLS).
create policy "device_codes_select_own" on public.device_codes
  for select using (auth.uid() = user_id);
create policy "device_codes_modify_own" on public.device_codes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
