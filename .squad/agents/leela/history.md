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
