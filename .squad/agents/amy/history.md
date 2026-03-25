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
