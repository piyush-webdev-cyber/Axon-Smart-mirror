-- ============================================================================
-- Axon - Migration 0004: Phase 3 Updates
-- ============================================================================
-- Add thumbnail_path to photos table for gallery optimization
-- ============================================================================

-- Add thumbnail_path column to photos
alter table public.photos 
  add column if not exists thumbnail_path text;

-- Add index for efficient photo queries
create index if not exists idx_photos_deleted_at on public.photos (deleted_at)
  where deleted_at is null;
