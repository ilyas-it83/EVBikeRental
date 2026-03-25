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

### 2026-03-25 — Sprint 1 Backend Complete

- **DB schema:** Drizzle ORM + better-sqlite3 with WAL mode. Tables: users, stations, bikes, rides, payments, refresh_tokens. All FKs enforced.
- **DB location:** `apps/api/data/evbike.db` — .gitignored. Schema pushed via `drizzle-kit push`.
- **Auth flow:** JWT access tokens (15min) + refresh tokens (30 days) stored in httpOnly cookies. bcryptjs cost 12. Token rotation on refresh.
- **Auth middleware:** `requireAuth` reads `access_token` cookie, verifies JWT, attaches user to `req.user`. `requireAdmin` chains on top.
- **API patterns:** Routes are thin controllers. Business logic lives in services (`auth.service.ts`, `station.service.ts`). Zod validates all inputs. Consistent error format `{ error: string, details?: any }`.
- **Station APIs:** List with Haversine distance filtering/sorting + computed availableBikes/emptyDocks. Detail includes full bike inventory.
- **Seed data:** 5 San Francisco stations, 25 bikes (5/station), 2 users (rider/admin), 3 completed rides + payments.
- **Shared types note:** `packages/shared` uses `BikeStatus.RENTED` but DB schema uses `in_use`. May need alignment in Sprint 2.
- **Express 5 quirk:** `req.params.id` is `string | string[]`, needs cast to `string`.
- **API Contracts Finalized:**
  - `POST /api/auth/register` → { id, email, name, isAdmin } + access_token + refresh_token cookies
  - `POST /api/auth/login` → { id, email, name, isAdmin } + cookies
  - `POST /api/auth/refresh` → new tokens in cookies
  - `POST /api/auth/logout` → cookies cleared
  - `GET /api/auth/me` → { id, email, name, isAdmin }
  - `GET /api/stations?lat=X&lng=Y&radiusKm=Z` → [{ id, name, lat, lng, availableBikes, emptyDocks }]
  - `GET /api/stations/:id` → { id, name, lat, lng, address, bikes: [{ id, status, bikeNumber }] }
- **Critical files:** `/apps/api/src/db/schema.ts`, `/apps/api/src/routes/auth.ts`, `/apps/api/src/routes/stations.ts`, `/apps/api/src/services/auth.service.ts`, `/apps/api/src/services/station.service.ts`
- **Tests passing:** 13 auth tests (registration, login, session management), 16 station tests (list filtering, distance calculation, detail endpoint)
