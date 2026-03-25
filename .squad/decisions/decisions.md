# Team Decisions

## Decision: PRD Created for EV Bike Rental

**Author:** Leela
**Date:** 2025-07-25
**Status:** Active (Modified 2026-03-25)

### Summary

Created the comprehensive Product Requirements Document at `docs/PRD.md`. This defines the full MVP scope and is now the source of truth for what we're building.

### Key Architectural Decisions (Original)

1. **Monorepo structure:** `/apps/web`, `/apps/api`, `/packages/shared` — keeps frontend and backend in sync with shared types.
2. **Tech stack:** ~~React + TypeScript frontend, Node.js + Express/Fastify + TypeScript backend, PostgreSQL + Prisma, Redis for caching~~ → **MODIFIED in Sprint 1** (see Tech Stack Simplification below)
3. **Auth:** JWT (access + refresh tokens) stored in httpOnly cookies. Bcrypt for passwords. ~~OAuth (Google, Apple) as secondary~~ → **Email/password only for MVP** (see Tech Stack Simplification)
4. **API style:** REST for CRUD, WebSocket for real-time station availability. No GraphQL — premature for MVP.
5. **Payments:** ~~Stripe with pre-auth hold pattern~~ → **Mock payment processor for MVP** (see Tech Stack Simplification)
6. **IoT integration:** Abstracted behind an interface. Mocked for MVP — vendor decision deferred.
7. **Maps:** ~~Mapbox GL JS~~ → **Leaflet.js + OpenStreetMap** (see Sprint 1 Frontend Architecture)
8. **Database:** ~~PostgreSQL with PostGIS~~ → **SQLite with Haversine** (see Tech Stack Simplification)
9. **Hosting:** Vercel (frontend) + Railway/Render (backend) — low-ops for MVP, migrate to cloud provider if needed at scale.
10. **Mobile-first web:** No native apps for MVP. React Native planned post-validation.

### Impact

- All agents should reference `docs/PRD.md` for scope and work item assignments.
- Work items W-001 through W-067 define the full MVP backlog.
- Fry owns frontend work, Bender owns backend, Amy owns tests, Leela owns architecture and review.

### Open Questions

- IoT lock vendor (mocked for now)
- Deployment region
- Native app timeline
- Legal review needed before launch

## Decision: Tech Stack Simplification — SQLite + Simple Auth

**Date:** 2026-03-25
**Author:** Leela (via user directive)
**Status:** Implemented

### Context

User requires the project to be fully self-contained with no external hosting dependencies.

### Decisions

**Database:** SQLite (replacing PostgreSQL + PostGIS)
- Use **SQLite** via `better-sqlite3` for all data storage
- Use **Drizzle ORM** (lightweight, SQLite-native) instead of Prisma
- Replace PostGIS spatial queries with **Haversine formula** in application code
- Database file stored locally in `/apps/api/data/evbike.db`

**Authentication:** Simple self-contained (replacing OAuth + external email)
- **Email/password only** — no Google OAuth, no external identity providers
- **JWT tokens** stored in httpOnly cookies — access token (15min) + refresh token (30 days)
- **Refresh tokens stored in SQLite** (no Redis dependency)
- **bcrypt** for password hashing (self-contained, no external service)
- **No email verification** for MVP — can add later with local SMTP or magic link
- Rate limiting via in-memory store (no Redis)

**Payments:** Local mock (replacing Stripe)
- Mock payment processor for MVP — simulates charge/refund lifecycle
- Can swap in Stripe later via adapter pattern

### Removed External Dependencies
- ~~PostgreSQL~~ → SQLite
- ~~PostGIS~~ → Haversine formula
- ~~Redis~~ → SQLite + in-memory
- ~~Stripe~~ → Mock payment adapter
- ~~SendGrid/Resend~~ → No email for MVP
- ~~Google OAuth~~ → Email/password only
- ~~Mapbox~~ → Leaflet.js + OpenStreetMap (free, no API key needed)

### Impact
- All user stories remain valid; only implementation details change
- Bender: Use Drizzle ORM + SQLite, Haversine for geo queries, mock payments
- Fry: Use Leaflet.js instead of Mapbox GL JS, no OAuth UI needed
- Amy: Tests run against local SQLite — no test DB provisioning needed
- Zero external service accounts required to run the app

## Decision: Backend API Patterns for Sprint 1

**Author:** Bender (Backend Dev)
**Date:** 2026-03-25
**Status:** Implemented

### Context
Sprint 1 backend needed auth, station APIs, and database foundation. Made several pragmatic decisions.

### Decisions

**1. SQLite with Drizzle ORM (not PostgreSQL)**
Per Leela's tech stack simplification, using SQLite via better-sqlite3 instead of PostgreSQL. Drizzle ORM provides type-safe queries. WAL mode enabled for concurrent reads. Sufficient for MVP; migration path to PostgreSQL exists via Drizzle's dialect swapping.

**2. JWT in httpOnly Cookies (not Authorization header)**
Access tokens (15min) and refresh tokens (30 days) stored in httpOnly, secure, sameSite=lax cookies. Prevents XSS token theft. Frontend never touches tokens directly — cookies flow automatically with `credentials: 'include'`.

**3. Refresh Token Rotation**
On `/api/auth/refresh`, the old refresh token is deleted and a new one issued. Limits replay window if a token leaks.

**4. Haversine in Application Layer**
Station distance calculated in JS, not SQL. SQLite lacks geospatial extensions. For 5-50 stations this is fine. If we scale to thousands, consider spatialite or move to PostGIS.

**5. Shared Types Drift**
`packages/shared` defines `BikeStatus.RENTED` but the DB schema uses `in_use` per the PRD. Also `PaymentStatus` has `authorized/captured` in shared but `completed/failed/refunded` in DB. This needs alignment — suggest updating shared types to match DB enums in Sprint 2.

### Impact
All Sprint 1 backend issues (#3, #4, #5, #7, #8) implemented with these patterns. Frontend can consume all endpoints via cookies.

## Decision: Sprint 1 Frontend Architecture

**Author:** Fry (Frontend Dev)
**Date:** 2026-03-25
**Status:** Implemented

### Context
Built the entire Sprint 1 frontend covering auth UI, API client, map view, and station detail panel.

### Decisions Made

**1. Leaflet + OpenStreetMap over Mapbox**
- Zero API keys needed — no cost, no signup, no secrets to manage
- `leaflet.markercluster` for marker clustering at low zoom
- Custom DivIcon markers with availability count + color coding

**2. Cookie-based auth with Axios interceptor**
- `withCredentials: true` on all requests
- 401 → attempt `/api/auth/refresh` → retry original → redirect to `/login` on failure
- Queue concurrent requests during refresh to avoid thundering herd

**3. Frontend-specific API response types**
- Shared package types use `latitude`/`longitude`; API contracts use `lat`/`lng`
- Created `StationSummary`, `StationDetail`, `StationBike`, `AuthUser` types in `lib/api.ts`
- These map 1:1 to the API response shapes

**4. Responsive station detail panel**
- Mobile: slides up from bottom (max 80vh), swipe indicator at top
- Desktop: side panel (w-96) with backdrop overlay
- Both: fetches full station detail on open, dismissible

**5. Test file exclusion from build tsconfig**
- `apps/web/tsconfig.json` excludes `__tests__/` and `test/` dirs
- Test files use vitest imports that break `tsc -b`
- Tests should use a separate tsconfig (e.g., `tsconfig.test.json` if needed)

## Decision: Test Infrastructure Choices

**Author:** Amy (Tester)
**Date:** 2026-03-25
**Status:** Implemented

### Context
Sprint 1 needed test infrastructure for both backend (Express/SQLite) and frontend (React/Vite).

### Decisions

1. **Vitest** as the test runner for both backend and frontend. It's Vite-native, fast, and shares config patterns across the monorepo.

2. **In-memory SQLite** for backend tests (not mocks). Each test suite gets a fresh DB with schema + seed data. This catches real SQL bugs that mocked DBs would miss.

3. **Tests written from requirements, not code.** Backend tests use inline mock route handlers matching the expected API contract. When real routes land, tests swap imports — assertions stay the same.

4. **Frontend tests use stub components** matching expected behavior. When Fry's real components land, imports change but test assertions remain stable.

5. **supertest** for backend HTTP testing (not raw fetch). Gives clean cookie/header handling for JWT auth testing.

6. **React Testing Library + userEvent** for frontend. Tests user behavior, not implementation details.

7. **Test files excluded from production tsconfig** (`__tests__/`, `test/`). Prevents vitest global types from breaking `tsc -b`.

### Trade-offs
- Mock route handlers in tests will need updating if Bender changes the API contract — but that's the point: tests document the contract.
- No E2E tests yet — those come after Sprint 1 features are integrated.

## Decision: Use --legacy-peer-deps for npm install

**Date:** 2026-03-25
**Author:** Leela
**Status:** Active

### Context

`eslint-plugin-react-hooks` declares a peer dependency on `eslint@^9.0.0` but npm's strict resolver conflicts with other ESLint tooling peer deps. This is a widely-known issue in the ecosystem.

### Decision

Use `--legacy-peer-deps` flag in all `npm install` and `npm ci` commands (including CI pipeline) until the ecosystem stabilizes.

### Consequences

- All team members and CI must use `--legacy-peer-deps` or add `.npmrc` with `legacy-peer-deps=true`
- This won't cause runtime issues — the plugins work fine with ESLint 9
- Revisit when eslint-plugin-react-hooks releases a clean peer dep declaration

## Decision: Docker-Based Self-Contained Hosting

**Date:** 2026-03-25
**Author:** Leela (via user directive)
**Status:** Deferred (Priority: Post-Sprint-1)

### Context

User requires the entire solution to be self-contained and hostable via Docker — no external infrastructure dependencies.

### Proposed Decision

**Docker Compose for Full Stack**
- **Single `docker-compose.yml`** at repo root spins up the entire app
- `docker compose up` is all that's needed to run everything

**Services**
| Service | Image | Purpose |
|---------|-------|---------|
| `web` | Custom (Node + Vite build) | React frontend served via Express static or nginx |
| `api` | Custom (Node + TypeScript) | Backend API with SQLite volume-mounted |
| `nginx` | nginx:alpine | Reverse proxy — routes `/api` to api, `/` to web |

**Container Strategy**
- **Multi-stage Dockerfiles** for both `apps/web` and `apps/api` (build → production)
- Frontend: build with Vite, serve static files via nginx
- Backend: compile TypeScript, run with Node.js
- SQLite DB file persisted via **Docker volume** (`evbike-data:/app/data`)

**Single-Container Option**
- Also provide a **single combined Dockerfile** at repo root for simplest deployment
- Runs both API and serves frontend from one container
- Ideal for small deployments, VPS, or local demo

**Developer Experience**
- `docker compose up --build` — full stack with hot reload (dev profile)
- `docker compose -f docker-compose.prod.yml up` — production build
- `.dockerignore` to keep images lean
- Health checks on both web and api services

**No External Dependencies Confirmed**
- SQLite file inside container volume (no DB server)
- JWT auth self-contained (no auth service)
- Mock payments (no Stripe)
- Leaflet + OpenStreetMap tiles (no Mapbox API key)
- Everything runs offline except map tiles (cacheable)

### Impact
- New user story needed: US-036 (Docker Setup) — Sprint 1 foundation
- Bender: Create Dockerfiles + docker-compose.yml
- Leela: Review container architecture
- Amy: Add container-based CI test target

## Decision: User Stories & Task Decomposition Complete

**Author:** Leela
**Date:** 2025-07-25
**Status:** Active

## Summary

Created `docs/USER-STORIES.md` — the full breakdown of the PRD into 35 user stories across 8 epics, with 160+ tasks assigned to agents. This is the execution plan.

## Decomposition Approach

1. **Epics map 1:1 to PRD feature areas** — Foundation, Auth, Discovery, Rental Flow, Payments, Ride History, Admin Dashboard, Launch Readiness.
2. **User stories are independently deliverable** — each has clear acceptance criteria that can be demo'd.
3. **Tasks are single-session scoped** — S (half day), M (1 day), L (2–3 days). No task should take more than one focused session.
4. **Dependencies are explicit** — both at story level (dependency graph) and task level (task table).
5. **Critical path identified** — Scaffold → DB → Auth → Payments → Ride Flow → E2E → Deploy. This chain spans all 4 sprints.

## Sprint Plan

- **Sprint 1 (Weeks 1–2):** Foundation + Auth + Discovery. Exit: user can register, log in, see station map.
- **Sprint 2 (Weeks 3–4):** Rental Flow + Payments. Exit: full ride loop works end-to-end.
- **Sprint 3 (Weeks 5–6):** Admin Dashboard + Subscriptions + Real-time. Exit: admins can manage fleet.
- **Sprint 4 (Weeks 7–8):** Polish + E2E + Security + Deploy. Exit: production-ready.

## Key Decisions

- Auth and Discovery run in parallel in Sprint 1 (different agents, no shared dependencies beyond scaffolding).
- IoT lock is mocked throughout all sprints — vendor decision deferred until after MVP validation.
- E2E tests (Playwright) are P0 — they gate the security audit and deployment.
- Performance audit is P1 — important but not a launch blocker if metrics are reasonable.
- Promo codes are P2 — backlogged unless Sprint 4 has capacity.

## Impact

- All agents should reference `docs/USER-STORIES.md` for their task assignments.
- Task IDs (T-xxx) are the unit of work for individual sessions.
- Sprint boundaries define review gates — Leela reviews at each sprint boundary.
