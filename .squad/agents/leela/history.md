# Project Context

- **Project:** EVBikeRental — an EV rental bike web application
- **Stack:** Web (TBD — likely JavaScript/TypeScript, React frontend, Node.js backend)
- **Created:** 2026-03-25

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2025-07-25 — PRD Created

- **PRD location:** `docs/PRD.md` — the source of truth for MVP scope, all 67 work items, and technical decisions.
- **Stack decided:** React 18+ / TypeScript frontend, Node.js + Express or Fastify / TypeScript backend, PostgreSQL + Prisma, Redis, Mapbox, Stripe.
- **Architecture:** Monorepo (`/apps/web`, `/apps/api`, `/packages/shared`). REST + WebSocket. JWT auth in httpOnly cookies.
- **IoT lock integration:** Abstracted behind an interface, mocked for MVP. Vendor TBD.
- **Key patterns:** Pre-auth hold on ride start, capture on end. Geospatial queries via PostGIS. Real-time station updates via WebSocket with polling fallback.
- **Work items:** W-001 to W-067 cover foundation, discovery, rental flow, payments, ride history, admin dashboard, and launch prep.
- **Agents:** Fry (frontend), Bender (backend), Amy (tests), Leela (architecture/review/CI/security).
- **Decision logged:** `.squad/decisions/inbox/leela-prd-created.md`

### 2025-07-25 — User Stories & Task Breakdown Created

- **File:** `docs/USER-STORIES.md` — 35 user stories, 8 epics, 160+ tasks, 4-sprint plan.
- **Decomposition:** Epics map 1:1 to PRD feature areas. Tasks sized S/M/L for single-session completion.
- **Sprint cadence:** 2-week sprints. Sprint 1 = foundation+auth+discovery, Sprint 2 = rental+payments, Sprint 3 = admin+subscriptions, Sprint 4 = polish+launch.
- **Critical path:** Scaffold → DB → Auth → Payments → Ride Flow → E2E → Deploy.
- **Parallel tracks:** Auth and Discovery run in parallel in Sprint 1 (different agents, independent after scaffolding).
- **Task IDs:** T-001 through T-325. These are the atomic units of work for agent sessions.
- **Decision logged:** `.squad/decisions/inbox/leela-user-stories.md`

### 2026-03-25 — Sprint 1 Complete: Foundation + Auth + Discovery

**Outcome:** All critical path items delivered. Monorepo scaffold, database schema, authentication APIs, station discovery with geospatial search, frontend UI with auth and interactive maps, comprehensive test suite.

**Agents & Issues:**
- Leela (leela-scaffold): #1 (Monorepo Foundation), #2 (CI/CD Pipeline) → 7 commits
- Bender (bender-sprint1): #3 (DB), #4-backend (Auth), #5-backend (Station List), #7-backend (Station Detail), #8-backend (Availability) → DB schema + auth/station APIs
- Fry (fry-sprint1): #4-frontend (Login/Register), #5-frontend (API Client), #6 (Station Map), #7-frontend (Detail Panel), #8-frontend (Availability Display) → full frontend UI
- Amy (amy-sprint1): #4-tests, #5-tests, #7-tests, #8-tests → 45 tests (29 backend, 16 frontend), all passing

**Key Technical Decisions:**
- Simplified tech stack: SQLite + Drizzle (not PostgreSQL), Leaflet + OSM (not Mapbox), JWT in cookies with rotation, Vitest for both backend/frontend
- Backend APIs: `/api/auth/*` (register/login/refresh/logout/me), `/api/stations` (list with Haversine), `/api/stations/:id` (detail + bike inventory)
- Frontend: Axios client with 401 refresh interceptor, AuthContext for state, Leaflet map with marker clustering, responsive station detail panel
- Test patterns: Mock implementations match API contracts; security assertions (password never in response, bcrypt verification, no email enumeration)

**Critical Files Created:**
- Backend: `/apps/api/src/db/schema.ts` (Drizzle), `/apps/api/src/routes/auth.ts`, `/apps/api/src/routes/stations.ts`, `/apps/api/src/services/`
- Frontend: `/apps/web/src/pages/login.tsx`, `/apps/web/src/pages/register.tsx`, `/apps/web/src/lib/api.ts`, `/apps/web/src/contexts/AuthContext.tsx`, `/apps/web/src/pages/map.tsx`
- Tests: `/apps/api/src/__tests__/auth.test.ts`, `/apps/api/src/__tests__/stations.test.ts`, `/apps/web/src/__tests__/auth.test.tsx`, `/apps/web/src/__tests__/map.test.tsx`

**Decisions Recorded:** 7 decisions merged into `.squad/decisions/decisions.md` — tech simplification, backend patterns, frontend architecture, test infrastructure, legacy peer deps, Docker hosting (deferred), user stories.
