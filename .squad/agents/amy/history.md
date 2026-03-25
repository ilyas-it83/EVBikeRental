# Project Context

- **Project:** EVBikeRental — an EV rental bike web application
- **Stack:** Web (TBD — likely JavaScript/TypeScript, React frontend, Node.js backend)
- **Created:** 2026-03-25

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2025-07-25 — Team Context: PRD Created

- **PRD location:** `docs/PRD.md` — your source of truth for test work items W-033–W-045 and full MVP scope.
- **Stack decided:** React 18+ / TypeScript frontend, Node.js + Express or Fastify / TypeScript backend, PostgreSQL + Prisma, Redis, Mapbox, Stripe.
- **Architecture:** Monorepo (`/apps/web`, `/apps/api`, `/packages/shared`). Shared types for end-to-end testing.
- **Testing responsibilities:** Unit tests (components, API routes), integration tests (auth, rental flow, payments), E2E tests (discovery to ride completion).
- **Key coverage areas:** Pre-auth hold → capture flow, geospatial queries, real-time WebSocket updates, JWT token refresh, error handling.
- **Your work items:** W-033–W-045 cover test infrastructure, unit/integration/E2E test suites, and CI setup.
- **Team leads:** Fry (frontend), Bender (backend), Leela (architecture/review/CI).

### 2026-03-25 — Sprint 1 Test Infrastructure & Suite Complete

- **Test runner:** Vitest for both backend and frontend. Configs at `apps/api/vitest.config.ts` and `apps/web/vitest.config.ts`.
- **Backend test DB:** In-memory SQLite via better-sqlite3, fresh per test suite. Schema includes users, stations, bikes, refresh_tokens tables.
- **Backend test helpers:** `apps/api/src/test/setup.ts` — createTestDb, seedTestData, createAuthenticatedUser, haversineDistance, token generators.
- **Frontend test helpers:** `apps/web/src/test/setup.ts` — jest-dom matchers, mock AuthContext factory, API mock utilities, test station data.
- **Test count:** 45 total (29 backend, 16 frontend), all passing.
- **Backend tests cover:** Auth registration (9), login (4), session management (7), station API (9) — all from acceptance criteria.
- **Frontend tests cover:** Auth forms/validation (8), map/station display (8) — all from acceptance criteria.
- **Key patterns:** Tests use mock implementations matching expected API contracts. When Bender/Fry's real code lands, tests swap mock routes for real imports.
- **Security tests included:** Password never in response, bcrypt hash verification, no email enumeration on login, token revocation on logout.
- **Commit:** `b3a6407` — all test infra and Sprint 1 suite.
- **tsconfig exclusion:** Test files excluded from production build (`__tests__`, `test/` dirs) to prevent tsc -b failures.
