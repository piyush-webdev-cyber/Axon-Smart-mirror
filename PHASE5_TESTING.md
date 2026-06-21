# Phase 5 — Camera, Gallery & QR Transfer Testing

## Prerequisites

1. Apply migration `0005_phase5_camera_gallery.sql` (or run `SUPABASE_SETUP.sql` updates).
2. Create Supabase Storage bucket **`axon-media`** (private, not public).
3. Backend `.env`: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET=axon-media`.
4. Backend on `8010`, frontend on `5173`.
5. Link mirror to account (QR device linking) — stores `axon_mirror_token` for photo API.

---

## Storage layout

```
axon-media/
  {user_id}/
    photos/
      YYYY/
        MM/
          photo_{timestamp}.jpg
          thumbnails/
            photo_{timestamp}.jpg
```

---

## Voice commands

| Say | Expected |
|-----|----------|
| "Nexa, take a photo" | Opens camera → 3s countdown → capture → upload → success |
| "Nexa, open camera" | Opens camera preview |
| "Nexa, show my photos" | Gallery opens with QR session (15 min) |
| "Nexa, open gallery" | Opens gallery grid on mirror |
| "Nexa, delete this photo" | Deletes selected (or most recent) photo |
| "Nexa, download my photos" | Same as show my photos (QR for phone) |

---

## Manual test flow

### 1. Capture & persist

1. Say **"Nexa, take a photo"** or tap capture on `/camera`.
2. Watch countdown **3 → 2 → 1 → 📸**.
3. Confirm **Photo Saved Successfully**.
4. Open gallery — photo appears with real thumbnail.

### 2. QR phone access

1. Say **"Nexa, show my photos"**.
2. Scan QR on mirror with phone.
3. Phone opens `/gallery/session/{token}`.
4. View thumbnails, full-screen, download, share.

### 3. Security

- Direct storage URLs without signed token should fail (bucket private).
- Gallery session token expires after **15 minutes**.
- Users only see their own photos (RLS + user-scoped API).

---

## WebSocket events

| Event | When |
|-------|------|
| `photo.capture_started` | Countdown begins (client) |
| `photo.capture_completed` | Frame captured (client) |
| `photo.upload_started` | Upload begins (client + server) |
| `photo.upload_completed` | Upload finished (server) |
| `gallery.opened` | QR session created |
| `gallery.closed` | QR dismissed |

---

## API endpoints

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/v1/photos` | JWT or `X-Mirror-Token` |
| GET | `/api/v1/photos` | JWT or mirror token |
| DELETE | `/api/v1/photos/{id}` | JWT or mirror token |
| POST | `/api/v1/gallery/sessions` | JWT or mirror token |
| GET | `/api/v1/gallery/sessions/{token}/photos` | Public (token) |

---

## Smoke tests

```bash
cd axon-backend
python -m pytest tests/test_smoke.py -q
```
