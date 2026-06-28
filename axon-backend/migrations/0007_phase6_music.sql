-- Phase 6: Smart Music Mode (YouTube)

create table if not exists public.music_user_state (
  user_id       uuid primary key references public.profiles (id) on delete cascade,
  volume        smallint not null default 70 check (volume between 0 and 100),
  shuffle       boolean not null default false,
  repeat_mode   text not null default 'off' check (repeat_mode in ('off', 'one', 'all')),
  is_playing    boolean not null default false,
  position_sec  double precision not null default 0,
  current_track jsonb,
  queue         jsonb not null default '[]'::jsonb,
  updated_at    timestamptz not null default now()
);

create table if not exists public.music_playlists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  name        text not null,
  playlist_type text not null default 'custom'
    check (playlist_type in ('favorites', 'recent', 'workout', 'relax', 'study', 'custom')),
  tracks      jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_music_playlists_user_id
  on public.music_playlists (user_id);

create table if not exists public.music_history (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  video_id      text not null,
  title         text not null,
  artist        text not null default '',
  thumbnail_url text,
  duration_sec  integer not null default 0,
  played_at     timestamptz not null default now()
);

create index if not exists idx_music_history_user_played
  on public.music_history (user_id, played_at desc);

alter table public.music_user_state enable row level security;
alter table public.music_playlists enable row level security;
alter table public.music_history enable row level security;

create policy "music_user_state_own" on public.music_user_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "music_playlists_own" on public.music_playlists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "music_history_own" on public.music_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
