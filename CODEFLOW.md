# Axon Smart Mirror - Codeflow Summary

**Last Updated:** Saturday, June 20, 2026, 11:35 PM (UTC+5:30)  
**Current Phase:** Phase 3 Complete ✅

## Project Overview

Axon is a premium AI-powered Smart Mirror application built with:
- **Frontend:** React 18 + TypeScript + Vite + TailwindCSS
- **Backend:** FastAPI (Python)
- **Database:** Supabase (PostgreSQL)
- **Real-time:** WebSocket communication
- **Authentication:** Supabase Auth (Google + Email)
- **State Management:** Zustand
- **Data Fetching:** TanStack Query

## Architecture

### Frontend Structure (`axon-frontend/`)

```
src/
├── app/                          # App bootstrap & routing
│   ├── App.tsx                   # Root component
│   ├── router.tsx                # React Router setup
│   ├── providers.tsx             # Context providers wrapper
│   ├── RequireAuth.tsx           # Protected route wrapper
│   └── GlobalEffects.tsx         # Global side effects
│
├── components/
│   ├── navigation/               # NEW: Premium sidebar navigation
│   │   ├── Sidebar.tsx           # Glass container with nav items
│   │   └── NavItem.tsx           # Individual nav link component
│   ├── ui/                       # Reusable UI primitives
│   │   ├── button.tsx            # Button component
│   │   └── card.tsx              # Card component (glass surface)
│   └── common/                   # Shared components
│       ├── BrandedLoader.tsx     # Loading spinner
│       ├── ErrorBoundary.tsx     # Error handling
│       └── OfflineBanner.tsx     # Network status banner
│
├── features/                     # Feature modules
│   ├── clock/                    # Top-left clock widget
│   │   ├── ClockWidget.tsx       # Display component (bold time)
│   │   └── useClock.ts           # Live time hook
│   │
│   ├── weather/                  # Top-right weather widget
│   │   ├── WeatherWidget.tsx     # Display component (bold, no bg)
│   │   ├── useWeather.ts         # Data hook (static placeholder)
│   │   └── weather.types.ts      # Weather domain types
│   │
│   ├── greeting/                 # Center greeting module
│   │   ├── GreetingModule.tsx    # "Good [Time], Name" display
│   │   └── useGreeting.ts        # Time-based greeting logic
│   │
│   ├── daily-focus/              # Daily focus card (REMOVED from UI)
│   │   ├── DailyFocusCard.tsx    # Glass pill with focus text
│   │   └── useDailyFocus.ts      # Static focus data
│   │
│   ├── voice/                    # Axon voice assistant button
│   │   ├── MicButton.tsx         # 4-state mic button (idle/listening/processing/speaking)
│   │   └── useVoiceController.ts # Voice FSM controller
│   │
│   └── system-status/            # Bottom status indicator
│       └── SystemStatusBar.tsx   # Online/offline status with beacon
│
├── layouts/
│   └── MirrorLayout.tsx          # Main layout with sidebar + content grid
│
├── pages/                        # Route pages
│   ├── HomePage.tsx              # Center: Greeting + Mic + Status
│   ├── SettingsPage.tsx          # Settings (protected)
│   └── auth/
│       ├── LoginPage.tsx         # Login page
│       └── CallbackPage.tsx      # OAuth callback
│
├── context/                      # React contexts
│   ├── AuthProvider.tsx          # Supabase auth wrapper
│   ├── ThemeProvider.tsx         # Theme management
│   └── ToastProvider.tsx         # Toast notifications
│
├── store/                        # Zustand store
│   ├── index.ts                  # Root store
│   └── slices/
│       ├── themeSlice.ts         # Theme state
│       ├── connectionSlice.ts    # WebSocket status
│       ├── voiceSlice.ts         # Voice FSM
│       └── systemSlice.ts        # System metadata
│
├── services/                     # External services
│   ├── websocketClient.ts        # WebSocket singleton
│   ├── apiClient.ts              # HTTP client wrapper
│   ├── supabaseClient.ts         # Supabase client
│   └── queryClient.ts            # TanStack Query config
│
├── hooks/                        # Custom hooks
│   ├── useWebSocketBridge.ts     # WS connection lifecycle
│   └── useOnlineStatus.ts        # Network status
│
├── styles/                       # Design system
│   ├── globals.css               # Base styles + utilities
│   └── themes.css                # 6 theme variants (black-mirror default)
│
├── constants/                    # App constants
│   ├── routes.ts                 # Route paths
│   ├── themes.ts                 # Theme registry
│   ├── queryKeys.ts              # TanStack Query keys
│   └── wsEvents.ts               # WebSocket event types
│
├── types/                        # TypeScript types
│   ├── voice.ts                  # Voice FSM types
│   ├── websocket.ts              # WebSocket message types
│   ├── user.ts                   # User domain types
│   └── api.ts                    # API response types
│
└── utils/
    ├── cn.ts                     # Class name merger (clsx + tailwind-merge)
    └── env.ts                    # Environment variable helpers
```

## Current UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│  ┌──────────┐                                   32°C ☀️     │
│  │ 04:57 PM │                                   Sunny       │
│  │ Sat, Jun │                                   📍 Location │
│  │          │                                                │
│  │ 🏠 Home   │          Good Afternoon, Piyush               │
│  │ 📷 Camera │                                                │
│  │ 💼 Interview│                                              │
│  │ 🖼️ Gallery │                                              │
│  │ 🎵 Songs  │                                                │
│  │ ⚙️ Settings│                                              │
│  │          │                                                │
│  │          │                  [Mic Button]                 │
│  │          │                  Say Nexa                      │
│  │          │                  ● ONLINE                     │
│  │          │                                                │
│  │ 👤 Login │                                                │
│  └──────────┘                                                │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Layout Breakdown

**Left Sidebar (11rem wide, fixed position):**
- Glassmorphism container (no visible border, backdrop blur)
- Clock/Date at top (bold typography)
- Nav items below (20px spacing after clock):
  - Home, Camera, Interview, Gallery, Songs, Settings
  - Icon + text horizontal layout
  - Blue glow on hover/active (no background by default)
- Login/Sign Up pill at bottom

**Main Content (centered, offset by sidebar):**
- **Top-right:** Weather (bold temp + icon, no container)
- **Center:** Greeting + Voice assistant + Status (vertically centered)
- **Ambient:** Radial blue glow backdrop (low center, subtle)

## Design System

### Typography
- **Font:** Inter (not Poppins - reverted)
- **Scale (Tailwind custom):**
  - `text-display-xl`: 3.25-9.5rem (clamp) - largest displays
  - `text-display-lg`: 2.25-6rem (clamp) - clock, weather temp
  - `text-heading`: 1.5-3.25rem (clamp) - greeting
  - `text-subheading`: 1.05-1.875rem (clamp) - date, weather label
  - `text-body`: 0.95-1.375rem (clamp) - body text
  - `text-caption`: 0.72-1rem (clamp) - small labels

### Colors (HSL tokens, theme: black-mirror)
```css
--background: 0 0% 0%           /* Pure black */
--foreground: 210 20% 96%       /* Off-white */
--primary: 190 95% 60%          /* Cyan-blue */
--accent: 250 90% 66%           /* Purple */
--surface: 220 18% 6%           /* Dark grey */
--surface-muted: 220 16% 9%     /* Slightly lighter grey */
--text-primary: 210 20% 96%     /* Main text */
--text-secondary: 215 14% 55%   /* Muted text */
--success: 150 72% 50%          /* Green */
--warning: 38 96% 58%           /* Orange */
--error: 0 80% 62%              /* Red */
--glow: 190 95% 60%             /* Cyan glow */
```

### Utilities (globals.css)
- `.text-glow`, `.text-glow-soft`, `.text-glow-strong` - Text shadows
- `.ring-glow`, `.ring-glow-strong` - Box shadows
- `.glass-surface` - Premium glass panel (gradient + blur + hairline)
- `.bg-glow-radial` - Radial gradient glow
- `.ai-aura` - Conic gradient for mic button
- `.gpu` - GPU compositing hint (will-change)

### Animations (60 FPS, transform/opacity only)
- `fade-in`, `fade-in-up`, `fade-in-down`, `fade-in-scale`
- `pulse-ring` - Expanding ring (listening state)
- `breathe` - Gentle scale pulse (idle mic)
- `glow-pulse` - Opacity pulse
- `orbit`, `orbit-reverse` - Rotation (processing state)
- `wave` - Waveform bars (speaking state)
- `beacon` - Status dot pulse
- `aurora-drift` - Slow ambient backdrop drift

## Key Features Implemented

### Phase 1 (Backend Foundation) ✅
- FastAPI backend with WebSocket support
- Supabase authentication (Google + Email)
- Database schema
- Real-time connection management

### Phase 2 (Premium UI) ✅
- Responsive mirror layout (CSS Grid)
- Live clock with smooth minute transitions
- Weather widget architecture (static data, API-ready)
- Time-aware greeting system
- Daily focus module (present in code, hidden from UI)
- Premium voice assistant button (4 visual states)
- System status indicator (WebSocket + network)
- 6 theme system (black-mirror default)

### Phase 2.1 (Navigation) ✅
- Left sidebar with glassmorphism
- 6 navigation items (Home, Camera, Interview, Gallery, Songs, Settings)
- Login/Sign Up CTA
- Responsive collapse (future)

### Phase 3 (Device Linking, Camera, Gallery) ✅
- QR code device linking (mirror ↔ phone)
- Camera integration with live preview
- Photo capture with caption
- Gallery with pagination (20 per page)
- Photo sharing via QR code
- Soft delete functionality
- Supabase Storage integration
- Thumbnail generation (server-side)
- RLS policies for user isolation

## Voice Assistant States

The mic button implements a finite state machine:

```
idle → listening → processing → speaking → idle
  ↓        ↓          ↓           ↓
  ←────────cancel─────────────────←
```

**Visual States:**
- **Idle:** Breathing glass disc, subtle rotating aura
- **Listening:** Blue glow + pulsing concentric rings
- **Processing:** Dual orbiting comet dots
- **Speaking:** 5-bar animated waveform

**Implementation:** `voiceSlice.ts` manages FSM, `useVoiceController.ts` exposes `press()` handler, `MicButton.tsx` renders all states. No audio pipeline yet (Phase 3).

## WebSocket Events

Defined in `wsEvents.ts`, handled by `websocketClient.ts`:

```typescript
SYSTEM_HEARTBEAT      // Keep-alive ping
SYSTEM_STATUS         // System health
VOICE_START           // Voice session start
VOICE_STOP            // Voice session end
VOICE_TRANSCRIPT      // STT result
VOICE_RESPONSE        // AI response
CONNECTION_STATUS     // Connection state change
```

## Environment Variables

**Frontend (`.env`):**
```bash
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_ANON_KEY=...
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws
```

**Backend (`.env`):**
```bash
SUPABASE_URL=https://...
SUPABASE_KEY=...
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-...
# ... (24 lines total, includes Replicate, Groq, etc.)
```

## Current State Summary

### ✅ Phase 1 & 2 Complete
1. Full authentication flow (Google + Email)
2. Premium Smart Mirror UI (glassmorphism, animations)
3. Live clock/weather widgets (weather is static placeholder)
4. Time-aware greeting with name personalization
5. Voice assistant button (all visual states, no audio yet)
6. System status indicator (WebSocket + network status)
7. Left navigation sidebar (glass container, 6 items)
8. Theme system (6 variants, token-based)
9. Responsive typography (clamp-based fluid scale)
10. Motion system (60 FPS, GPU-accelerated)

### ✅ Phase 3 Complete (June 20, 2026)
11. **QR Device Linking:**
    - Mirror generates device code on startup
    - QR code display with polling
    - Phone linking page with Google OAuth
    - Auto-update mirror greeting after link

12. **Camera Integration:**
    - Live camera preview (1280x720)
    - Photo capture with canvas
    - Optional caption input
    - Upload to Supabase Storage
    - Automatic thumbnail generation (400x400)

13. **Photo Gallery:**
    - Responsive grid layout (2-5 columns)
    - Pagination (20 photos per page)
    - Photo detail modal
    - Soft delete functionality

14. **Photo Sharing:**
    - QR code generation for photos
    - 24-hour signed URLs
    - Scan-to-download on phone

15. **Backend Infrastructure:**
    - Device service (code generation, linking, status)
    - Photo service (upload, list, delete, share)
    - RLS policies for user isolation
    - Pillow for image processing

### 🚧 In Progress / Stubbed
1. **Weather API integration:** `useWeather.ts` returns static data. Needs:
   - Real weather provider (Open-Meteo suggested)
   - Location detection or user input
   - TanStack Query integration (queryKeys.weather already defined)

2. **Voice functionality:** FSM + UI complete, but no audio pipeline:
   - Future Phase: Wake word detection, STT, TTS
   - WebSocket events defined but not wired

3. **Navigation routes:** Interview, Songs are placeholder links:
   - Camera + Gallery now functional ✅
   - Interview (InterviewGPT) - planned for Phase 5
   - Songs - planned for future phase

4. **Daily Focus:** Module exists but hidden from HomePage:
   - Future: AI-generated daily goals from backend

### ❌ Not Started
1. Interview/InterviewGPT module (Phase 5)
2. Music playback system (Future Phase)
3. Face recognition (Phase 6)
4. Voice AI backend pipeline (Phase 4)
5. User settings persistence
6. Device health monitoring (CPU, temp)

## Development Commands

```bash
# Frontend
cd axon-frontend
npm install
npm run dev          # Dev server (http://localhost:5173)
npm run build        # Production build
npm run preview      # Preview production build
npm run typecheck    # TypeScript check
npm run lint         # ESLint

# Backend
cd axon-backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload  # Dev server (http://localhost:8000)
```

## Design Decisions & Notes

1. **No Poppins:** User requested Poppins but later reverted to Inter for consistency.

2. **Sidebar Evolution:**
   - Originally minimal (no container)
   - Now has glass container with no visible border
   - Nav items have blue glow highlights on hover/active

3. **Typography Weights:**
   - Clock/Weather use `font-semibold` for bold display
   - Nav items use `font-light` for elegance
   - Greeting uses mixed weights (light salutation, semibold name)

4. **Center Alignment:**
   - Main content is truly centered (not shifted right)
   - Sidebar is fixed and doesn't affect center calculations
   - Achieved via `ml-[11rem]` offset on content wrapper

5. **Glassmorphism:**
   - Only used on sidebar and mic button
   - Minimal elsewhere (no cards on weather/status)
   - `.glass-surface` utility: gradient + blur + hairline + shadow

6. **Performance:**
   - All animations use `transform`/`opacity` only
   - GPU compositing hints (`.gpu` class)
   - Target: 60 FPS on Raspberry Pi

7. **Theme System:**
   - 6 themes: black-mirror (default), dark, light, glass, cyber, minimal
   - Token-based (HSL variables in themes.css)
   - Swapping themes never touches component code

## Next Agent Instructions

If you're continuing this project:

1. **Check current UI first:** Run `npm run dev` to see the exact state.

2. **Respect existing architecture:**
   - Don't refactor Phase 1/2 unless explicitly asked
   - Use existing design tokens (no hardcoded colors)
   - Follow the feature module pattern (`features/*`)

3. **Common user requests:**
   - "Make X bold" → Update `font-semibold` in component
   - "Remove background" → Check if `.glass-surface` or inline bg
   - "Add spacing" → Use Tailwind spacing (mb-*, gap-*, etc.)
   - "Center content" → Verify sidebar offset isn't shifting center

4. **To add a new feature (e.g., Camera page):**
   ```bash
   # 1. Create page component
   src/pages/CameraPage.tsx
   
   # 2. Add route to constants
   src/constants/routes.ts: camera: "/camera"
   
   # 3. Update router
   src/app/router.tsx: Add lazy-loaded route
   
   # 4. Update Sidebar nav item
   src/components/navigation/Sidebar.tsx: Add `to: ROUTES.camera`
   ```

5. **To integrate weather API:**
   ```typescript
   // src/features/weather/useWeather.ts
   export function useWeather() {
     const { data, status } = useQuery({
       queryKey: queryKeys.weather(location),
       queryFn: () => fetchWeather(location),
     });
     return { data, status, isPlaceholder: false };
   }
   ```

6. **Voice pipeline integration (Phase 3):**
   - Backend needs: STT (Whisper), TTS, LLM
   - Frontend: Dispatch existing voice events via WebSocket
   - FSM already handles all transitions

## File Change History (This Session)

**Major Changes:**
1. Created sidebar navigation system (`Sidebar.tsx`, `NavItem.tsx`)
2. Redesigned clock to be bold (`font-semibold`)
3. Redesigned weather to be bold, inline format
4. Removed Daily Focus card from HomePage
5. Moved clock into sidebar (then kept it there)
6. Added "Songs" nav item
7. Removed nav item borders/backgrounds (then restored highlights)
8. Removed visible border from sidebar glass container
9. Added 20px extra spacing below clock

**Current Font:** Inter (Poppins was tested but reverted)

---

**End of Codeflow Summary**

Use this document to quickly onboard and understand the current state. Always verify UI state by running `npm run dev` before making changes.
