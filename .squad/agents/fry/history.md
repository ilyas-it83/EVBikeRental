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
