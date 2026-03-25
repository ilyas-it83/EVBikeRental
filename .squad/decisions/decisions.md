# Team Decisions

## Decision: PRD Created for EV Bike Rental

**Author:** Leela
**Date:** 2025-07-25
**Status:** Active

### Summary

Created the comprehensive Product Requirements Document at `docs/PRD.md`. This defines the full MVP scope and is now the source of truth for what we're building.

### Key Architectural Decisions

1. **Monorepo structure:** `/apps/web`, `/apps/api`, `/packages/shared` — keeps frontend and backend in sync with shared types.
2. **Tech stack:** React + TypeScript frontend, Node.js + Express/Fastify + TypeScript backend, PostgreSQL + Prisma, Redis for caching.
3. **Auth:** JWT (access + refresh tokens) stored in httpOnly cookies. Bcrypt for passwords. OAuth (Google, Apple) as secondary.
4. **API style:** REST for CRUD, WebSocket for real-time station availability. No GraphQL — premature for MVP.
5. **Payments:** Stripe with pre-auth hold pattern. No card data on our servers.
6. **IoT integration:** Abstracted behind an interface. Mocked for MVP — vendor decision deferred.
7. **Maps:** Mapbox GL JS for interactive station/bike maps.
8. **Database:** PostgreSQL with PostGIS for geospatial queries (nearby stations).
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
