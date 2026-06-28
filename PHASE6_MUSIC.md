# Phase 6: Smart Music Mode

YouTube-backed music with voice + touch control, queue management, playlists, and history.

## Setup

### 1. Supabase migration

Run `axon-backend/migrations/0007_phase6_music.sql` in the Supabase SQL Editor.

### 2. YouTube API (recommended)

Add to `axon-backend/.env`:

```env
YOUTUBE_API_KEY=your-google-api-key
```

Enable **YouTube Data API v3** in Google Cloud Console. Without a key, search falls back to public Invidious instances (less reliable).

### 3. Deploy backend + frontend

Music requires mirror auth (`X-Mirror-Token` / linked session headers) like Camera/Gallery.

## Voice commands

| Say | Action |
|-----|--------|
| Open music | Navigate to Music page |
| Play Believer | Search + play |
| Play relaxing music | Search + play |
| Pause / resume / stop music | Playback control |
| Next / previous song | Skip tracks |
| Volume up / down, mute / unmute | Volume |
| Shuffle / repeat | Queue modes |

## API (`/api/v1/music`)

- `GET /search?q=` — YouTube search
- `POST /play` — `{ query?, videoId?, track? }`
- `POST /pause`, `/resume`, `/stop`, `/next`, `/previous`
- `POST /volume` — `{ volume?, delta?, mute? }`
- `POST /seek`, `/shuffle`, `/repeat`, `/finished`
- `GET /state`, `/queue`, `/history`, `/playlists`

## WebSocket events

`music.started`, `music.paused`, `music.resumed`, `music.progress`, `music.finished`, `music.queue.updated`, `music.volume.changed`, `music.search.completed`, `music.state`

## Architecture

- **Backend:** `MusicService` + `YouTubeMusicProvider` (swap provider in `music_providers/` for Spotify later)
- **Frontend:** `MusicPage` + lazy `YouTubePlayer` (IFrame API) + `musicSlice` + `musicApi`
- **Playback:** Audio/video via YouTube IFrame on the mirror; backend owns queue/state/history

## Testing locally

1. Link mirror (QR)
2. Open **Music** in sidebar
3. Search or say *“Play lofi”*
4. Confirm transport controls + queue panel
