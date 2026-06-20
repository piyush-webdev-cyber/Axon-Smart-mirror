# Axon Database Migrations

Supabase Postgres schema for Axon. Apply migrations **in order**.

## Files

| Order | File | Purpose |
| ----- | ---- | ------- |
| 1 | `0001_init.sql` | Extensions, `set_updated_at()` trigger fn, `handle_new_user()` auto-provisioning fn |
| 2 | `0002_schema.sql` | All tables (`profiles`, `settings`, `photos`, `interviews`, `conversations`, `face_profiles`, `goals`, `device_codes`), indexes, `updated_at` triggers, and the `auth.users` insert trigger |
| 3 | `0003_rls.sql` | Enables Row Level Security and per-table owner policies |

## How to apply

### Option A - Supabase Dashboard

1. Open your project -> SQL Editor.
2. Paste and run each file in order (0001, then 0002, then 0003).

### Option B - Supabase CLI

```bash
supabase db push
# or run individual files:
psql "$DATABASE_URL" -f migrations/0001_init.sql
psql "$DATABASE_URL" -f migrations/0002_schema.sql
psql "$DATABASE_URL" -f migrations/0003_rls.sql
```

## Notes

- Phase 1 only reads/writes `profiles` and `settings`. The other tables exist so
  future phases require no destructive migrations.
- All tables use UUID PKs, `created_at`/`updated_at`, and RLS scoped to
  `auth.uid()`.
- `handle_new_user()` runs as `security definer` so a new signup automatically
  gets a profile + default settings row.
- Server-side trusted operations (e.g. issuing/claiming device codes) use the
  Supabase **service role** key, which bypasses RLS by design.
