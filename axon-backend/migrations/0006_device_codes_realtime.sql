-- Realtime + anon read for mirror device-link polling (Supabase Realtime on mirror UI).
-- Run after 0002_schema.sql and 0005_phase5_camera_gallery.sql

alter table public.device_codes replica identity full;

drop policy if exists "device_codes_anon_select_for_linking" on public.device_codes;
create policy "device_codes_anon_select_for_linking"
  on public.device_codes
  for select
  to anon
  using (status in ('pending', 'linked'));

-- Enable Realtime in Supabase Dashboard: Database → Replication → device_codes
-- Or run once (ignore error if table already in publication):
-- alter publication supabase_realtime add table public.device_codes;
