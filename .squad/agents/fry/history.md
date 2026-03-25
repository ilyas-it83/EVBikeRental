# Project Context

- **Project:** EVBikeRental — an EV rental bike web application
- **Stack:** Web (TBD — likely JavaScript/TypeScript, React frontend, Node.js backend)
- **Created:** 2026-03-25

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2025-07-25 — Team Context: PRD Created

- **PRD location:** `docs/PRD.md` — your source of truth for frontend work items W-001–W-016 and full MVP scope.
- **Stack decided:** React 18+ / TypeScript frontend, Node.js + Express or Fastify / TypeScript backend, PostgreSQL + Prisma, Redis, Mapbox, Stripe.
- **Architecture:** Monorepo (`/apps/web`, `/apps/api`, `/packages/shared`). Shared types between frontend and backend.
- **Frontend responsibilities:** Ride discovery, booking UI, real-time station updates (WebSocket), payment UX, user dashboard, admin dashboard.
- **Key patterns:** Pre-auth hold on ride start, capture on end. Mapbox GL JS for maps. Mobile-first responsive design.
- **Your work items:** W-001–W-016 cover React setup, auth UI, maps, booking flow, and station displays.
- **Team leads:** Bender (backend), Amy (tests), Leela (architecture/review/CI).

### 2025-07-25 — Sprint 1 Frontend Complete

- **Map stack:** Using Leaflet.js + OpenStreetMap tiles (NOT Mapbox) — zero API keys required. `leaflet.markercluster` for clustering.
- **Auth pattern:** Cookie-based auth with `withCredentials: true`. Axios 401 interceptor refreshes token, retries request, redirects to /login on failure. AuthContext provides `useAuth()` hook.
- **API types:** Created frontend-specific API response types (`AuthUser`, `StationSummary`, `StationDetail`, `StationBike`) in `apps/web/src/lib/api.ts` aligned with backend contracts. Shared package types use `latitude`/`longitude` but API contracts use `lat`/`lng`.
- **Station markers:** Color-coded by available bike count — green (≥3), yellow (1-2), red (0). DivIcon with count inside.
- **Station detail panel:** Responsive — slides up from bottom on mobile, side panel on desktop. Fetches full station detail with bike list on open.
- **Build config:** Test files (`__tests__/`, `test/`) must be excluded from `apps/web/tsconfig.json` — they have vitest-specific imports that break `tsc -b`.
- **Component library:** Basic `Button`, `Input`, `Spinner` in `components/ui/`. `ToastProvider` for global notifications.
- **File structure:** `lib/api.ts`, `contexts/AuthContext.tsx`, `components/`, `pages/` — follows Leela's scaffold.
