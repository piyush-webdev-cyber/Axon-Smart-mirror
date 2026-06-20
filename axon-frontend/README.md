# Axon - Frontend

The premium mirror UI for **Axon**, an AI-powered smart mirror. Built to feel
futuristic and luxurious, and to run smoothly on a Raspberry Pi 5 kiosk while
also working on laptops, desktops, and vertical/horizontal displays.

> Phase 1 = architecture + foundation only. Voice, camera, face recognition,
> interview mode, music, and QR sharing are intentionally **not** implemented;
> their seams exist so future phases drop in without rewrites.

## Tech stack

- **React 18 + Vite + TypeScript** (strict)
- **TailwindCSS + shadcn/ui** with a CSS-variable theme system
- **Zustand** for client/UI state, **TanStack Query** for server state
- **React Router v6** data router with route-based code splitting
- **Supabase JS** for auth (Google + email)

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Supabase + API URLs
npm run dev                  # http://localhost:5173
```

Other scripts:

```bash
npm run build       # typecheck + production build
npm run preview     # preview the production build
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
```

## Environment

| Variable | Description |
| -------- | ----------- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon public key |
| `VITE_API_BASE_URL` | Axon backend REST base (e.g. `http://localhost:8000/api/v1`) |
| `VITE_WS_URL` | Axon backend WebSocket URL (e.g. `ws://localhost:8000/api/v1/ws`) |

The app boots even without these set (Supabase falls back to placeholders), so
you can explore the UI before wiring the backend.

## Folder structure

```
src/
  app/          App shell: providers, router, global effects, App root
  pages/        Route-level screens (lazy-loaded): home, settings, auth/*
  layouts/      MirrorLayout - the fluid region grid (clock, weather, center, mic, status)
  components/
    ui/         shadcn/ui primitives (Button, Card, ...)
    common/     Shared composites (ErrorBoundary, OfflineBanner, BrandedLoader)
  features/     Self-contained feature modules
    clock/        Live clock widget
    weather/      Weather widget (stub UI)
    system-status/ System status bar
    voice/        MicButton + voice FSM controller (foundation for Phase 3)
  services/     External I/O: apiClient, supabaseClient, websocketClient, queryClient
  hooks/        Cross-feature hooks (online status, websocket bridge)
  context/      React providers: Theme, Auth, Toast
  store/        Zustand root store + feature slices
  types/        Shared TypeScript contracts
  constants/    Routes, themes, query keys, WS event names
  utils/        Pure helpers (cn, env)
  styles/       globals.css + themes.css (theme tokens)
  assets/       Static assets
```

**Why feature-based?** Each feature owns its components, hooks, and slice, so the
12 planned features can be added or removed in isolation without tangling.

## Architecture highlights

### Theme system

Themes are blocks of HSL design tokens in `src/styles/themes.css`, scoped to a
`[data-theme="..."]` attribute on `<html>`. Tailwind maps semantic colors to
`hsl(var(--token))`, so **changing themes never touches component code**. Default
is `black-mirror`; `dark`, `light`, `glass`, `cyber`, and `minimal` are reserved
token sets. The active theme is persisted to `localStorage` (and, in Phase 2,
synced to the user's `settings.theme`).

### State management

- `useAppStore` (Zustand) composes `themeSlice`, `connectionSlice`,
  `voiceSlice`, and `systemSlice`. Always read via selectors to keep re-renders
  surgical (important for 60 FPS on the Pi).
- Server data lives in **TanStack Query**, never duplicated into the store.

### Voice mic button (Phase 3 foundation)

`voiceSlice` is an explicit finite-state machine: `idle -> listening ->
processing -> speaking -> idle`. Illegal transitions are impossible. The
`MicButton` renders per-state visuals today; Phase 3 dispatches the same events
from real audio pipelines.

### WebSocket

`services/websocketClient.ts` is a resilient singleton (auto-reconnect with
exponential backoff + heartbeat). Features subscribe by event type via
`websocketClient.subscribe(WS_EVENTS.x, handler)` - the transport never changes
when new real-time features arrive.

### Error handling & offline

Top-level `ErrorBoundary`, TanStack Query retry policy (never retries
401/403/501), `apiClient` network-error normalization, an `OfflineBanner` driven
by `navigator.onLine`, and a lightweight toast system.

### Performance

Route + vendor code splitting (`manualChunks`), lazy pages, transform/opacity
animations only, `prefers-reduced-motion` support, and a lean dependency set.
