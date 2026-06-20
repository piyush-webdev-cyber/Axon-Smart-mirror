# Axon - Backend

FastAPI backend for **Axon**, the AI-powered smart mirror. Stateless, async, and
layered so future phases (voice, InterviewGPT, face recognition, music, device
linking) attach without restructuring.

> Phase 1 = architecture + foundation. Future features are exposed as documented
> placeholder endpoints that return HTTP `501 Not Implemented`, locking the API
> surface in place.

## Tech stack

- **FastAPI** (async) + **Uvicorn**
- **Pydantic v2** schemas (camelCase JSON to match the TS frontend)
- **Supabase** for auth (JWT verification), Postgres, and storage
- **PyJWT** for verifying Supabase access tokens

## Getting started

```bash
python -m venv .venv
.venv\Scripts\activate            # Windows
# source .venv/bin/activate       # macOS/Linux
pip install -r requirements.txt
copy .env.example .env            # then fill in values

uvicorn app.main:app --reload --port 8000
```

- Interactive docs: http://localhost:8000/docs
- OpenAPI schema: http://localhost:8000/openapi.json

Quality:

```bash
ruff check app tests    # lint
pytest -q               # smoke tests
```

## Environment

| Variable | Description |
| -------- | ----------- |
| `AXON_ENV` | `development` / `production` |
| `AXON_DEBUG` | Verbose logging when true |
| `AXON_API_PREFIX` | API + WS prefix (default `/api/v1`) |
| `AXON_CORS_ORIGINS` | Comma-separated allowed origins (the frontend) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Anon key (RLS-respecting client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (trusted ops, bypasses RLS) |
| `SUPABASE_JWT_SECRET` | Verifies user access tokens (HS256) |
| `GEMINI_API_KEY` | Reserved for future AI phases |
| `SUPABASE_STORAGE_BUCKET` | Bucket for future media |

The app boots without Supabase configured; protected routes simply return `401`
until `SUPABASE_JWT_SECRET` is set.

## Folder structure

```
app/
  main.py          App factory: CORS, exception handlers, router mounting, lifespan
  api/
    router.py      Aggregates all v1 routers
    deps.py        Shared dependencies (get_current_user / JWT gate)
    routes/        Thin HTTP routers: health, system, auth, users, placeholders
  core/            Single source of config, logging, security, error types
  schemas/         Pydantic request/response models (API contract)
  services/        Business logic (keeps routes thin and testable)
  middleware/      Global exception handling -> consistent error envelope
  db/              Supabase client provider (anon + service role)
  ai/              Gemini wrapper (stub; provider-agnostic seam)
  storage/         Supabase Storage wrapper (stub)
  websockets/      ConnectionManager, event registry, WS endpoint
  utils/           Shared helpers
migrations/        Supabase SQL (see migrations/README.md)
tests/             Smoke tests
```

**Why layered?** Routes stay thin; business rules live in `services/`; all
external systems (DB, AI, storage) sit behind wrappers. Swapping a provider or
adding a feature touches one layer, not the whole app.

## API surface (v1)

Active in Phase 1:

- `GET  /api/v1/health` - liveness
- `GET  /api/v1/system/info` - static system info
- `GET  /api/v1/system/status` - live status (uptime, connections)
- `POST /api/v1/auth/session` - verify Supabase session (auth required)
- `POST /api/v1/auth/logout` - logout hook (auth required)
- `GET  /api/v1/users/me` - current profile (auth required)
- `PATCH /api/v1/users/me` - update profile (auth required)
- `GET  /api/v1/users/me/settings` - get settings (auth required)
- `PATCH /api/v1/users/me/settings` - update settings (auth required)

Reserved placeholders (documented, return `501`):

- `/api/v1/voice/*`, `/api/v1/photos/*`, `/api/v1/interviews/*`,
  `/api/v1/face/*`, `/api/v1/music/*`

WebSocket: `WS /api/v1/ws` - typed `{ type, payload, timestamp }` envelope, with
a heartbeat (`system.ping`/`system.pong`) and a handler registry pre-wired for
future real-time events.

## Authentication

The frontend authenticates with Supabase (Google + email). It forwards the
Supabase access token as a `Bearer` header; `get_current_user` verifies it
(HS256 via `SUPABASE_JWT_SECRET`) and yields a typed user. The backend is
stateless. Physical-mirror **device linking** is modeled in the `device_codes`
table and reserved auth hooks for a future phase.

## Error envelope

Every error returns:

```json
{ "error": { "code": "string", "message": "string", "details": null } }
```

## Database

See [`migrations/README.md`](migrations/README.md). Tables: `profiles`,
`settings` (active in Phase 1) plus `photos`, `interviews`, `conversations`,
`face_profiles`, `goals`, `device_codes` (reserved). All use UUID PKs,
`created_at`/`updated_at`, and Row Level Security scoped to `auth.uid()`.
