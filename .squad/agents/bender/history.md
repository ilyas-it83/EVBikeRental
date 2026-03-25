# Project Context

- **Project:** EVBikeRental — an EV rental bike web application
- **Stack:** Web (TBD — likely JavaScript/TypeScript, React frontend, Node.js backend)
- **Created:** 2026-03-25

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2025-07-25 — Team Context: PRD Created

- **PRD location:** `docs/PRD.md` — your source of truth for backend work items W-017–W-032 and full MVP scope.
- **Stack decided:** React 18+ / TypeScript frontend, Node.js + Express or Fastify / TypeScript backend, PostgreSQL + Prisma, Redis, Mapbox, Stripe.
- **Architecture:** Monorepo (`/apps/web`, `/apps/api`, `/packages/shared`). Shared types between frontend and backend.
- **Backend responsibilities:** REST API for CRUD, WebSocket for real-time station updates, Stripe integration, JWT auth, rental engine, ride tracking.
- **Key patterns:** Pre-auth hold on ride start, capture on end. PostGIS for geospatial queries. JWT in httpOnly cookies.
- **Your work items:** W-017–W-032 cover API foundation, auth, rental flow, payments, ride history, and IoT abstraction layer.
- **Team leads:** Fry (frontend), Amy (tests), Leela (architecture/review/CI).
