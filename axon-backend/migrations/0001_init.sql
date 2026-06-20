-- ============================================================================
-- Axon - Migration 0001: extensions, shared helpers, user auto-provisioning
-- ============================================================================
-- Run order: 0001 -> 0002 -> 0003. Apply via the Supabase SQL editor or CLI.
--
-- Design principles (applied across all Axon migrations):
--   * UUID primary keys everywhere (distributed-friendly, no enumeration)
--   * created_at / updated_at on every table (auditing + sync)
--   * updated_at maintained automatically by a trigger
--   * Row Level Security on by default (see 0003) - users only see their data
--   * Future-feature tables created now so later phases need no schema churn
-- ============================================================================

-- pgcrypto provides gen_random_uuid()
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Shared trigger: keep updated_at current on every UPDATE
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Auto-provision a profile + default settings whenever a Supabase auth user
-- is created. This keeps `public.profiles` 1:1 with `auth.users` automatically.
-- ----------------------------------------------------------------------------
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

-- Note: the trigger on auth.users is created in 0002 (after the tables exist).
