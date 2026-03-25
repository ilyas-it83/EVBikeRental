# User Stories & Task Breakdown — EV Bike Rental

**Version:** 1.0
**Author:** Leela (Lead)
**Date:** 2025-07-25
**Source:** [docs/PRD.md](./PRD.md)
**Status:** Draft

---

## How to Read This Document

- **Epics** map to PRD feature areas
- **User Stories** are independently deliverable increments within an epic
- **Tasks** are single-session units of work for one agent
- **Estimates:** S = half day, M = 1 day, L = 2–3 days
- **Agents:** Fry (frontend/UI), Bender (backend/API/DB), Amy (tests), Leela (architecture/review)
- **Priority:** P0 = must ship for MVP, P1 = should ship, P2 = nice to have
- Cross-references use `US-{n}` for stories and `T-{n}` for tasks

---

## Epic 1: Foundation & Project Setup

> Get the monorepo, tooling, CI, and database in place so everyone else can build on solid ground.

### US-001: Project Scaffolding

**As a** developer, **I want to** have a well-structured monorepo with consistent tooling, **so that** all team members can start building features immediately with shared conventions.

**Acceptance Criteria:**
- [ ] Monorepo contains `/apps/web` (React 18 + Vite + TypeScript), `/apps/api` (Node.js + Express/Fastify + TypeScript), `/packages/shared` (types, constants, utilities)
- [ ] ESLint + Prettier configured with shared config across all packages
- [ ] TypeScript strict mode enabled; tsconfig extends from root
- [ ] `npm install` from root installs all dependencies (workspaces)
- [ ] `npm run dev` starts both frontend and backend in parallel
- [ ] `.env.example` files in both apps with documented variables
- [ ] README with setup instructions

**Tasks:**
| ID | Task | Assigned To | Estimate | Dependencies |
|----|------|-------------|----------|--------------|
| T-001 | Initialize npm workspaces monorepo with `/apps/web`, `/apps/api`, `/packages/shared` | Leela | M | none |
| T-002 | Scaffold React + Vite + TypeScript app in `/apps/web` with Tailwind CSS + shadcn/ui | Fry | M | T-001 |
| T-003 | Scaffold Express/Fastify + TypeScript app in `/apps/api` with folder structure (routes, services, middleware) | Bender | M | T-001 |
| T-004 | Create shared types package (`/packages/shared`) with API response types, constants, enums | Bender | S | T-001 |
| T-005 | Configure ESLint + Prettier with shared rules, lint-staged + husky for pre-commit | Leela | S | T-002, T-003 |
| T-006 | Add root scripts: `dev` (concurrently), `build`, `lint`, `typecheck` | Leela | S | T-005 |

**Priority:** P0

---

### US-002: CI/CD Pipeline

**As a** developer, **I want to** have automated checks on every PR, **so that** broken code never reaches the main branch.

**Acceptance Criteria:**
- [ ] GitHub Actions workflow runs on every PR to `main`
- [ ] Jobs: lint, type-check, unit tests, build — for both frontend and backend
- [ ] Pipeline fails fast (lint before tests, tests before build)
- [ ] Status checks required before merge (branch protection rule documented)
- [ ] Pipeline completes in under 5 minutes

**Tasks:**
| ID | Task | Assigned To | Estimate | Dependencies |
|----|------|-------------|----------|--------------|
| T-007 | Create `.github/workflows/ci.yml` with lint, typecheck, test, build jobs | Leela | M | T-006 |
| T-008 | Add caching for `node_modules` and build artifacts to speed up pipeline | Leela | S | T-007 |
| T-009 | Document branch protection rules in CONTRIBUTING.md | Leela | S | T-007 |

**Priority:** P0

---

### US-003: Database Schema & Seed Data

**As a** backend developer, **I want to** have the complete Prisma schema with migrations and seed data, **so that** all API work can begin immediately against a real database.

**Acceptance Criteria:**
- [ ] Prisma schema defines all core entities: User, Station, Bike, Ride, Payment, Subscription, Reservation, PromoCode
- [ ] PostGIS extension enabled; Station has geographic point column for proximity queries
- [ ] All relationships, indexes, and constraints properly defined
- [ ] Initial migration runs cleanly on a fresh PostgreSQL 15+ database
- [ ] Seed script populates: 5 stations, 25 bikes (5 per station), 2 users (rider + admin), sample rides
- [ ] `npm run db:migrate` and `npm run db:seed` scripts work from `/apps/api`

**Tasks:**
| ID | Task | Assigned To | Estimate | Dependencies |
|----|------|-------------|----------|--------------|
| T-010 | Define Prisma schema with all entities, relations, indexes, and enums | Bender | L | T-003 |
| T-011 | Enable PostGIS extension; add lat/lng fields with spatial index on Station | Bender | S | T-010 |
| T-012 | Create seed script with realistic sample data (stations, bikes, users, rides) | Bender | M | T-010 |
| T-013 | Add npm scripts for migrate, seed, reset; document in README | Bender | S | T-012 |

**Priority:** P0

---

## Epic 2: Authentication

> Let riders and admins sign up, log in, and stay securely authenticated.

### US-004: User Registration

**As a** new rider, **I want to** create an account with my email and password, **so that** I can start renting bikes.

**Acceptance Criteria:**
- [ ] Registration endpoint accepts email, password, name, phone (optional)
- [ ] Password validated: minimum 8 characters, at least one letter and one number
- [ ] Passwords hashed with bcrypt (cost factor 12) — never stored in plaintext
- [ ] Duplicate email returns 409 Conflict with clear error message
- [ ] On success: user created, verification email sent, JWT pair returned
- [ ] Stripe customer created and linked to user record
- [ ] Frontend sign-up page with form validation, loading state, and error display
- [ ] OAuth registration (Google) as alternative flow

**Tasks:**
| ID | Task | Assigned To | Estimate | Dependencies |
|----|------|-------------|----------|--------------|
| T-020 | Implement registration endpoint: validate input (Zod), hash password, create user, issue JWT pair | Bender | M | T-010 |
| T-021 | Add email verification: generate token, send verification email (SendGrid/Resend), verify endpoint | Bender | M | T-020 |
| T-022 | Integrate Stripe customer creation on registration | Bender | S | T-020 |
| T-023 | Implement Google OAuth flow (passport.js or manual OAuth2) | Bender | M | T-020 |
| T-024 | Build sign-up page: form (email, password, name), validation, error states, OAuth button | Fry | M | T-002, T-040 |
| T-025 | Build email verification page: handle token from email link, show success/error | Fry | S | T-021, T-024 |
| T-026 | Unit tests for registration service (valid input, duplicate email, weak password, OAuth) | Amy | M | T-020, T-023 |
| T-027 | Integration test: full registration flow including email verification | Amy | S | T-021 |

**Priority:** P0

---

### US-005: User Login & Session Management

**As a** returning rider, **I want to** log in quickly and stay logged in across sessions, **so that** I don't have to re-authenticate every time.

**Acceptance Criteria:**
- [ ] Login endpoint accepts email + password; returns access token (15 min) and refresh token (30 days)
- [ ] Tokens stored in httpOnly, secure, sameSite cookies — not localStorage
- [ ] Token refresh endpoint issues new access token using valid refresh token
- [ ] Logout invalidates refresh token server-side
- [ ] Failed login: generic "invalid credentials" message (no email enumeration)
- [ ] Rate limiting: 10 attempts per minute per IP on login endpoint
- [ ] Frontend: login page, auto-redirect if already authenticated, token refresh interceptor in API client
- [ ] Protected route wrapper redirects unauthenticated users to login

**Tasks:**
| ID | Task | Assigned To | Estimate | Dependencies |
|----|------|-------------|----------|--------------|
| T-030 | Implement login endpoint with credential validation and JWT issuance | Bender | M | T-020 |
| T-031 | Implement token refresh endpoint; store refresh tokens in Redis with TTL | Bender | S | T-030 |
| T-032 | Implement logout endpoint: invalidate refresh token in Redis | Bender | S | T-031 |
| T-033 | Add auth middleware: validate access token, attach user to request, handle expired tokens | Bender | M | T-030 |
| T-034 | Add rate limiting middleware on auth endpoints (10 req/min/IP) | Bender | S | T-030 |
| T-035 | Build login page: email/password form, OAuth button, "forgot password" link, error states | Fry | M | T-024 |
| T-036 | Implement auth context/provider: store auth state, auto-refresh tokens, provide `useAuth` hook | Fry | M | T-040 |
| T-037 | Build protected route wrapper: redirect to login if unauthenticated | Fry | S | T-036 |
| T-038 | Unit tests for login, token refresh, logout, middleware | Amy | M | T-030, T-031, T-033 |
| T-039 | Integration test: login → access protected route → token expires → auto-refresh → still authenticated | Amy | M | T-033 |

**Priority:** P0

---

### US-006: API Client Setup

**As a** frontend developer, **I want to** have a typed, pre-configured API client, **so that** all feature work uses consistent error handling and authentication.

**Acceptance Criteria:**
- [ ] Axios or fetch-based client with base URL from environment variable
- [ ] Automatic access token attachment via cookie (or header interceptor)
- [ ] Auto-retry on 401: refresh token → retry original request → redirect to login if refresh fails
- [ ] Typed request/response using shared types from `/packages/shared`
- [ ] Global error handler: toast for user-facing errors, Sentry for unexpected errors
- [ ] Request/response logging in development mode

**Tasks:**
| ID | Task | Assigned To | Estimate | Dependencies |
|----|------|-------------|----------|--------------|
| T-040 | Create API client module with base config, interceptors, and typed methods | Fry | M | T-002, T-004 |
| T-041 | Implement 401 interceptor: auto-refresh and retry | Fry | S | T-040, T-036 |
| T-042 | Add global error toast component and wire to API client error handler | Fry | S | T-040 |

**Priority:** P0

---

## Epic 3: Bike Discovery

> Help riders find available bikes near them — fast.

### US-007: Station Map View

**As a** rider, **I want to** see all nearby stations on an interactive map, **so that** I can quickly find the closest bike.

**Acceptance Criteria:**
- [ ] Map renders using Mapbox GL JS, centered on user's geolocation (with permission prompt)
- [ ] Fallback center: city center coordinates if geolocation denied
- [ ] Station markers color-coded: green (≥3 bikes), yellow (1–2 bikes), red (0 bikes)
- [ ] Marker clusters at lower zoom levels for performance
- [ ] Tapping a marker opens the station detail panel (US-008)
- [ ] Map is responsive and touch-friendly (pinch to zoom, drag to pan)
- [ ] Stations loaded from API; loading skeleton while fetching

**Tasks:**
| ID | Task | Assigned To | Estimate | Dependencies |
|----|------|-------------|----------|--------------|
| T-050 | Implement station list API endpoint with geospatial proximity query (PostGIS `ST_DWithin`) | Bender | M | T-011 |
| T-051 | Add available bike count and empty dock count as computed fields on station response | Bender | S | T-050 |
| T-052 | Build Mapbox map component with geolocation, zoom controls, responsive layout | Fry | L | T-040 |
| T-053 | Render station markers with color-coded availability; implement clustering at low zoom | Fry | M | T-052, T-050 |
| T-054 | Unit tests for station proximity query (various distances, empty results) | Amy | S | T-050 |
| T-055 | Component tests for map: renders markers, handles geolocation denial, shows loading state | Amy | M | T-053 |

**Priority:** P0

---

### US-008: Station Detail View

**As a** rider, **I want to** see detailed information about a station, **so that** I can decide if it has a bike that meets my needs (battery level, dock availability).

**Acceptance Criteria:**
- [ ] Tapping a station marker opens a slide-up panel (mobile) or side panel (desktop)
- [ ] Panel shows: station name, address, distance from user, walking time estimate
- [ ] List of available bikes with battery percentage and visual battery indicator
- [ ] Empty dock count displayed prominently (for return planning)
- [ ] "Reserve" button (if reservation feature available) and "Unlock" button
- [ ] Panel is dismissible (swipe down on mobile, click outside on desktop)

**Tasks:**
| ID | Task | Assigned To | Estimate | Dependencies |
|----|------|-------------|----------|--------------|
| T-060 | Implement station detail API endpoint: station info + list of bikes at station with battery levels | Bender | S | T-050 |
| T-061 | Build station detail panel component: slide-up on mobile, side panel on desktop | Fry | M | T-053 |
| T-062 | Add bike list with battery indicators, reserve/unlock CTAs, distance/walking time | Fry | M | T-061 |
| T-063 | Component tests for station detail panel: data display, dismiss behavior, empty states | Amy | S | T-062 |

**Priority:** P0

---

### US-009: Station List View

**As a** rider who prefers lists or uses a screen reader, **I want to** browse stations in a sortable list, **so that** I can find bikes without relying on the map.

**Acceptance Criteria:**
- [ ] Table/list view of nearby stations (alternative to map, togglable via tab or button)
- [ ] Columns: station name, distance, available bikes, empty docks
- [ ] Sortable by distance (default), available bikes, name
- [ ] Tapping a row opens the station detail panel (US-008)
- [ ] Accessible: proper table semantics, keyboard navigable, screen reader labels
- [ ] Empty state if no stations nearby

**Tasks:**
| ID | Task | Assigned To | Estimate | Dependencies |
|----|------|-------------|----------|--------------|
| T-070 | Build station list component with sort controls and empty state | Fry | M | T-050, T-040 |
| T-071 | Add toggle between map view and list view (tabs or segmented control) | Fry | S | T-052, T-070 |
| T-072 | Accessibility audit: verify table semantics, keyboard nav, ARIA labels | Amy | S | T-070 |

**Priority:** P1

---

### US-010: Real-Time Station Availability

**As a** rider, **I want to** see bike and dock availability update in real time, **so that** I don't walk to a station only to find it empty.

**Acceptance Criteria:**
- [ ] WebSocket endpoint broadcasts station availability changes within 5 seconds of change
- [ ] Frontend subscribes on map/list mount; markers and list update without page refresh
- [ ] Graceful fallback: if WebSocket connection fails, poll `/stations` every 30 seconds
- [ ] Visual indicator when data is stale (e.g., "Last updated X seconds ago")
- [ ] Connection status indicator (connected / reconnecting)

**Tasks:**
| ID | Task | Assigned To | Estimate | Dependencies |
|----|------|-------------|----------|--------------|
| T-080 | Implement WebSocket server (ws or Socket.io) that publishes station availability changes | Bender | M | T-050 |
| T-081 | Emit availability update events when rides start/end or bikes change status | Bender | S | T-080, T-100 |
| T-082 | Frontend WebSocket client: subscribe, update station state, auto-reconnect | Fry | M | T-053 |
| T-083 | Implement polling fallback: detect WS failure, switch to 30s polling, switch back on reconnect | Fry | S | T-082 |
| T-084 | Add "last updated" indicator and connection status badge | Fry | S | T-082 |
| T-085 | Integration test: change bike status → verify WS client receives update within 5s | Amy | M | T-080, T-082 |

**Priority:** P1

---

## Epic 4: Rental Flow

> The core loop: scan, unlock, ride, return, pay.

### US-011: Unlock a Bike

**As a** rider, **I want to** unlock a bike by scanning its QR code, **so that** I can start my ride instantly.

**Acceptance Criteria:**
- [ ] QR scanner opens device camera and reads bike QR code (contains bike ID)
- [ ] Alternative: manual bike ID entry for bikes with damaged QR codes
- [ ] On scan: validate bike is available → call unlock API → show success/failure
- [ ] Unlock API sends command to IoT lock interface (mocked for MVP)
- [ ] Unlock completes in under 3 seconds (UX requirement)
- [ ] Error handling: bike unavailable, bike in maintenance, payment method missing, unlock hardware failure
- [ ] User must have a verified email and payment method on file to unlock

**Tasks:**
| ID | Task | Assigned To | Estimate | Dependencies |
|----|------|-------------|----------|--------------|
| T-090 | Build QR scanner component using `html5-qrcode`: camera permission, scan, extract bike ID | Fry | M | T-002 |
| T-091 | Add manual bike ID entry fallback (text input + submit) | Fry | S | T-090 |
| T-092 | Implement IoT lock interface (abstract class) + mock implementation with configurable delay | Bender | M | T-003 |
| T-093 | Implement unlock API: validate bike status, validate user (verified, has payment), call IoT lock, create ride | Bender | M | T-092, T-100 |
| T-094 | Wire QR scan result to unlock API; show loading spinner, success animation, or error with retry | Fry | M | T-090, T-093 |
| T-095 | Unit tests for IoT lock interface (mock) and unlock validation logic | Amy | S | T-092, T-093 |
| T-096 | Integration test: scan QR → unlock → ride created → bike status updated | Amy | M | T-093 |

**Priority:** P0

---

### US-012: Active Ride Experience

**As a** rider currently on a bike, **I want to** see my ride duration, estimated cost, and nearby return stations, **so that** I can plan when and where to end my ride.

**Acceptance Criteria:**
- [ ] Full-screen ride-in-progress view activates after successful unlock
- [ ] Live timer counting up from 00:00
- [ ] Running cost estimate updated every second based on pricing tier
- [ ] Map showing user's approximate location and nearby return stations with dock availability
- [ ] Prominent "End Ride" button (red, fixed at bottom)
- [ ] Warning notification at 3 hours (approaching daily rate cap)
- [ ] Ride state persisted on server — app crash doesn't lose the ride
- [ ] Handles connectivity loss: timer continues locally, syncs on reconnect

**Tasks:**
| ID | Task | Assigned To | Estimate | Dependencies |
|----|------|-------------|----------|--------------|
| T-100 | Implement ride service: `startRide` (create Ride record, update bike status), `getActiveRide` (current ride for user) | Bender | L | T-010, T-092 |
| T-101 | Implement ride cost estimator: calculate running cost based on duration and user's pricing tier | Bender | M | T-100, T-130 |
| T-102 | Build active ride screen: timer, cost display, map with return stations, "End Ride" CTA | Fry | L | T-052, T-100 |
| T-103 | Handle offline state: local timer continues, show "reconnecting" indicator, sync on reconnect | Fry | M | T-102 |
| T-104 | Unit tests for ride service (start, active ride query, concurrent ride prevention) | Amy | M | T-100 |
| T-105 | Component tests for active ride screen: timer ticks, cost updates, end ride button | Amy | S | T-102 |

**Priority:** P0

---

### US-013: End Ride & Return Bike

**As a** rider, **I want to** end my ride by docking the bike at any station, **so that** I'm charged the correct amount and the bike is available for others.

**Acceptance Criteria:**
- [ ] "End Ride" button triggers: call end ride API → bike locks → ride finalized
- [ ] End ride API: calculate final cost, capture Stripe payment, update bike status to available, assign to end station
- [ ] If no docks available: prompt rider to dock at nearest station with open docks
- [ ] Out-of-dock return allowed with $5 surcharge (shown to user before confirming)
- [ ] Ride summary screen shown immediately after ride ends (US-014)
- [ ] Receipt auto-emailed to rider
- [ ] Idempotent: tapping "End Ride" twice doesn't double-charge

**Tasks:**
| ID | Task | Assigned To | Estimate | Dependencies |
|----|------|-------------|----------|--------------|
| T-110 | Implement `endRide` service: calculate final duration/cost, lock bike via IoT, update records | Bender | L | T-100, T-130 |
| T-111 | Integrate Stripe payment capture on ride end (capture pre-auth hold) | Bender | M | T-110, T-120 |
| T-112 | Handle out-of-dock return: surcharge logic, user confirmation flow | Bender | S | T-110 |
| T-113 | Send ride receipt email on ride completion (async, via queue or background job) | Bender | M | T-110 |
| T-114 | Build ride end flow in frontend: confirm end → loading → show ride summary | Fry | M | T-102, T-110 |
| T-115 | Unit tests for endRide (normal, out-of-dock, idempotency, payment capture) | Amy | M | T-110, T-111 |
| T-116 | Integration test: start ride → ride for X minutes → end ride → verify payment captured → receipt sent | Amy | L | T-111, T-113 |

**Priority:** P0

---

### US-014: Ride Summary & Receipt

**As a** rider, **I want to** see a clear summary of my completed ride, **so that** I know exactly what I was charged and why.

**Acceptance Criteria:**
- [ ] Ride summary screen shows: duration, start/end station, cost breakdown (base + per-min + surcharges - discounts), total
- [ ] Map snippet showing start and end stations (static map image or mini map)
- [ ] "Report an Issue" link (leads to dispute flow)
- [ ] "View in Ride History" link
- [ ] Screen shown immediately after ride ends; also accessible from ride history

**Tasks:**
| ID | Task | Assigned To | Estimate | Dependencies |
|----|------|-------------|----------|--------------|
| T-117 | Build ride summary screen: cost breakdown, station info, duration, map snippet | Fry | M | T-114 |
| T-118 | Add "Report Issue" CTA linking to dispute form (US-023) | Fry | S | T-117 |
| T-119 | Component tests: summary displays correct data, handles missing distance gracefully | Amy | S | T-117 |

**Priority:** P0

---

### US-015: Bike Reservation

**As a** rider, **I want to** reserve a bike for up to 10 minutes, **so that** it's still available when I walk to the station.

**Acceptance Criteria:**
- [ ] Reserve endpoint: creates reservation, marks bike as reserved (not available to others)
- [ ] Reservation expires after 10 minutes — bike becomes available again
- [ ] One active reservation per user at a time
- [ ] Cancellation: user can cancel reservation manually
- [ ] Starting a ride on reserved bike auto-cancels the reservation
- [ ] Frontend: "Reserve" button on station detail → countdown timer → "Cancel" option
- [ ] Expired reservation: background job or TTL-based cleanup

**Tasks:**
| ID | Task | Assigned To | Estimate | Dependencies |
|----|------|-------------|----------|--------------|
| T-140 | Implement reservation service: create, cancel, expire. One-per-user constraint. | Bender | M | T-100 |
| T-141 | Add reservation expiry: cron job (node-cron) or database-level TTL check | Bender | S | T-140 |
| T-142 | Wire reservation into ride start: auto-cancel reservation when ride begins | Bender | S | T-140, T-100 |
| T-143 | Build reservation UI: reserve button, countdown timer, cancel button | Fry | M | T-062, T-140 |
| T-144 | Unit tests: create, cancel, expire, concurrent reservation attempt | Amy | M | T-140 |

**Priority:** P1

---

## Epic 5: Payments

> Handle money correctly — pre-auth, capture, subscriptions, refunds.

### US-016: Payment Method Management

**As a** rider, **I want to** add and manage my payment methods, **so that** I can pay for rides seamlessly.

**Acceptance Criteria:**
- [ ] Add credit/debit card via Stripe Elements (PCI-compliant — card data never touches our server)
- [ ] Support Apple Pay and Google Pay where browser supports it
- [ ] View list of saved payment methods with last 4 digits and expiry
- [ ] Set a default payment method
- [ ] Delete a payment method (unless it's the only one and user has active subscription)
- [ ] Payment method required before first ride

**Tasks:**
| ID | Task | Assigned To | Estimate | Dependencies |
|----|------|-------------|----------|--------------|
| T-120 | Implement Stripe integration: create SetupIntent, attach payment method to customer, list/delete methods | Bender | L | T-022 |
| T-121 | Add webhook handler for Stripe events: payment_method.attached, payment_method.detached, payment_intent.succeeded/failed | Bender | M | T-120 |
| T-122 | Build payment methods page: Stripe Elements card form, saved cards list, set default, delete | Fry | L | T-040, T-120 |
| T-123 | Unit tests for Stripe integration (using Stripe test mode + mock webhooks) | Amy | M | T-120, T-121 |

**Priority:** P0

---

### US-017: Pay-Per-Ride Pricing

**As a** rider, **I want to** be charged a fair, transparent per-minute rate, **so that** I only pay for the time I actually ride.

**Acceptance Criteria:**
- [ ] Pricing: $1 unlock fee + $0.15/minute (configurable in admin)
- [ ] Pre-authorization hold of $25 placed at ride start
- [ ] Actual amount captured at ride end (hold released if less)
- [ ] Cost breakdown shown: unlock fee + (minutes × rate) + surcharges − discounts = total
- [ ] Pricing engine handles edge cases: ride < 1 min (minimum charge = unlock fee), ride > 4h (daily cap)
- [ ] All prices stored in cents (integer) to avoid floating-point errors

**Tasks:**
| ID | Task | Assigned To | Estimate | Dependencies |
|----|------|-------------|----------|--------------|
| T-130 | Implement pricing engine: calculate ride cost from duration, plan type, and active promos | Bender | M | T-010 |
| T-131 | Implement pre-auth hold at ride start ($25 via Stripe PaymentIntent with capture_method=manual) | Bender | M | T-120, T-100 |
| T-132 | Implement payment capture at ride end: calculate final amount, capture or adjust PaymentIntent | Bender | M | T-130, T-131 |
| T-133 | Add admin-configurable pricing tiers: CRUD API for pricing settings | Bender | S | T-130 |
| T-134 | Display pricing info in station detail panel and during active ride | Fry | S | T-062, T-102 |
| T-135 | Unit tests for pricing engine: all rate tiers, daily cap, minimum charge, zero-duration edge case | Amy | M | T-130 |
| T-136 | Integration test: start ride → wait → end ride → verify correct amount captured in Stripe | Amy | M | T-131, T-132 |

**Priority:** P0

---

### US-018: Subscription Plans

**As a** frequent rider, **I want to** subscribe to a monthly plan, **so that** I get discounted rides and included minutes.

**Acceptance Criteria:**
- [ ] Two plans: Monthly ($14.99/mo) and Annual ($119.99/yr)
- [ ] Subscribers get 30 minutes included per ride; overage at $0.08/min (vs $0.15)
- [ ] Subscribe via Stripe Billing (recurring charge)
- [ ] Manage subscription: view current plan, renewal date, cancel, change plan
- [ ] Cancellation: effective at end of current billing period (no proration)
- [ ] Pricing engine automatically applies subscription benefits during cost calculation

**Tasks:**
| ID | Task | Assigned To | Estimate | Dependencies |
|----|------|-------------|----------|--------------|
| T-150 | Implement subscription service: create Stripe subscription, store locally, handle webhooks (renewed, cancelled, failed) | Bender | L | T-120 |
| T-151 | Integrate subscription status into pricing engine (included minutes, reduced rate) | Bender | S | T-150, T-130 |
| T-152 | Build subscription page: plan comparison cards, subscribe CTA, current plan management | Fry | M | T-040, T-150 |
| T-153 | Build subscription management UI: current plan details, cancel flow with confirmation, change plan | Fry | M | T-152 |
| T-154 | Unit tests for subscription service (create, cancel, renew, webhook handling) | Amy | M | T-150 |
| T-155 | Integration test: subscribe → ride with included minutes → verify reduced charge | Amy | M | T-151 |

**Priority:** P1

---

### US-019: Promo Codes

**As a** rider, **I want to** apply a promo code for a discount, **so that** I can save money on rides.

**Acceptance Criteria:**
- [ ] Promo code input field during checkout or in account settings
- [ ] Validation: code exists, not expired, not maxed out, not already used by this user
- [ ] Discount types: percentage off ride cost, fixed dollar amount off
- [ ] Discount applied in pricing engine during cost calculation
- [ ] Admin CRUD for promo codes (creation, deactivation, usage tracking)

**Tasks:**
| ID | Task | Assigned To | Estimate | Dependencies |
|----|------|-------------|----------|--------------|
| T-160 | Implement promo code CRUD API (admin) and apply endpoint (rider) | Bender | M | T-130 |
| T-161 | Integrate promo code discounts into pricing engine | Bender | S | T-160, T-130 |
| T-162 | Build promo code input UI (account settings or ride summary) | Fry | S | T-040 |
| T-163 | Build admin promo code management page (create, view usage, deactivate) | Fry | M | T-200, T-160 |
| T-164 | Unit tests: valid code, expired code, maxed out, duplicate use, pricing integration | Amy | M | T-160, T-161 |

**Priority:** P2

---

## Epic 6: Ride History & Receipts

> Let riders review past rides and handle billing issues.

### US-020: View Ride History

**As a** rider, **I want to** see a list of all my past rides, **so that** I can track my usage and spending.

**Acceptance Criteria:**
- [ ] Paginated list of rides ordered by date (newest first)
- [ ] Each row: date, start/end station names, duration, total cost
- [ ] Filterable by date range
- [ ] Tap a ride to see full detail (US-014 ride summary view, reused)
- [ ] Empty state for new users with no rides
- [ ] Loads in < 500ms for typical user (< 100 rides)

**Tasks:**
| ID | Task | Assigned To | Estimate | Dependencies |
|----|------|-------------|----------|--------------|
| T-170 | Implement ride history API: paginated list with filters (date range, status), ride detail with cost breakdown | Bender | M | T-100 |
| T-171 | Build ride history page: paginated list, date filter, tap-to-detail, empty state | Fry | M | T-040, T-170 |
| T-172 | Wire ride detail to ride summary component (reuse from US-014) | Fry | S | T-171, T-117 |
| T-173 | Unit tests for ride history API: pagination, filters, empty results | Amy | S | T-170 |
| T-174 | Component tests for ride history page: renders rides, pagination works, empty state | Amy | S | T-171 |

**Priority:** P0

---

### US-021: Receipt Export

**As a** rider, **I want to** download a PDF receipt or export my rides as CSV, **so that** I can file expense reports.

**Acceptance Criteria:**
- [ ] "Download Receipt" button on ride detail generates a PDF with: date, stations, duration, cost breakdown, company info
- [ ] "Export All" option: download all rides as CSV with date range filter
- [ ] Files generated server-side; served via signed URL (expires in 1 hour)
- [ ] PDF includes company branding (logo, address)

**Tasks:**
| ID | Task | Assigned To | Estimate | Dependencies |
|----|------|-------------|----------|--------------|
| T-180 | Implement PDF receipt generation (using `pdfkit` or `puppeteer`) | Bender | M | T-170 |
| T-181 | Implement CSV export endpoint with date range filter | Bender | S | T-170 |
| T-182 | Upload generated files to S3/R2; return signed download URL | Bender | S | T-180 |
| T-183 | Add "Download Receipt" and "Export All" buttons to ride history UI | Fry | S | T-171, T-180 |
| T-184 | Unit tests for PDF content and CSV format | Amy | S | T-180, T-181 |

**Priority:** P1

---

### US-022: Dispute a Ride

**As a** rider, **I want to** report an issue with a ride, **so that** I can get a refund if something went wrong.

**Acceptance Criteria:**
- [ ] "Report Issue" button on ride detail opens a dispute form
- [ ] Form: reason dropdown (overcharged, bike problem, couldn't dock, other) + free-text description
- [ ] Submit creates a dispute record linked to the ride; ride status changes to "disputed"
- [ ] Admin can view disputes in admin dashboard and resolve (refund or reject)
- [ ] Rider receives email when dispute is resolved

**Tasks:**
| ID | Task | Assigned To | Estimate | Dependencies |
|----|------|-------------|----------|--------------|
| T-190 | Implement dispute API: create dispute, list disputes (admin), resolve dispute (refund/reject) | Bender | M | T-170 |
| T-191 | Integrate refund flow: on dispute approval, issue Stripe refund | Bender | S | T-190, T-120 |
| T-192 | Build dispute form UI: reason selector, description field, submit with confirmation | Fry | M | T-117, T-190 |
| T-193 | Build admin dispute resolution UI (part of admin dashboard — US-027) | Fry | M | T-200, T-190 |
| T-194 | Unit tests for dispute creation, resolution, refund integration | Amy | M | T-190, T-191 |

**Priority:** P1

---

## Epic 7: Admin Dashboard

> Give operators full visibility and control over the fleet, stations, users, and revenue.

### US-023: Admin Layout & Access Control

**As an** admin, **I want to** access a protected admin dashboard, **so that** I can manage the bike-share system.

**Acceptance Criteria:**
- [ ] `/admin` route group accessible only to users with admin roles
- [ ] Roles: `super_admin` (all access), `ops_manager` (fleet + stations), `support_agent` (users + rides)
- [ ] Sidebar navigation: Fleet Overview, Stations, Bikes, Users, Analytics, Alerts, Settings
- [ ] Header: current user name/role, logout button
- [ ] RBAC enforced at both API and UI level — API returns 403 for unauthorized role
- [ ] Non-admin users see 404 (not 403) to avoid revealing admin routes exist

**Tasks:**
| ID | Task | Assigned To | Estimate | Dependencies |
|----|------|-------------|----------|--------------|
| T-200 | Implement RBAC middleware: role-based route protection, role hierarchy | Bender | M | T-033 |
| T-201 | Build admin layout: sidebar, header, role-based nav item visibility | Fry | M | T-037, T-200 |
| T-202 | Add admin route group with role guards (redirect non-admins to 404) | Fry | S | T-201 |
| T-203 | Unit tests for RBAC middleware: all roles, edge cases, 403 vs 404 behavior | Amy | M | T-200 |

**Priority:** P0

---

### US-024: Fleet Overview

**As an** operations manager, **I want to** see all bikes and stations on a real-time map, **so that** I can monitor fleet health at a glance.

**Acceptance Criteria:**
- [ ] Admin map view shows all stations and individual bikes (when zoomed in)
- [ ] Bikes color-coded by status: green (available), blue (in use), orange (low battery), red (maintenance)
- [ ] Click a station to see bike list; click a bike to see detail (ID, battery, current rider if in-use, last maintenance)
- [ ] Filter: by bike status, by station, by battery threshold
- [ ] Summary stats bar: total bikes, in-use count, available count, maintenance count, low-battery count

**Tasks:**
| ID | Task | Assigned To | Estimate | Dependencies |
|----|------|-------------|----------|--------------|
| T-210 | Implement admin fleet API: all bikes with current status, station, battery; aggregate stats | Bender | M | T-050, T-200 |
| T-211 | Build admin fleet map (extend rider map component with bike-level detail and filters) | Fry | L | T-052, T-201 |
| T-212 | Add summary stats bar above map: total, in-use, available, maintenance, low battery | Fry | S | T-211 |
| T-213 | Component tests for admin map: filter behavior, click interactions, stats display | Amy | M | T-211 |

**Priority:** P0

---

### US-025: Station Management

**As an** admin, **I want to** create, edit, and deactivate stations, **so that** I can expand or adjust the network.

**Acceptance Criteria:**
- [ ] Data table of all stations: name, address, total docks, available bikes, status (active/inactive)
- [ ] Sortable and searchable
- [ ] "Add Station" form: name, address, dock count, pin-drop on map for lat/lng
- [ ] Inline edit for existing stations
- [ ] Toggle station active/inactive (inactive stations don't appear to riders)
- [ ] Confirmation dialog before deactivation (warns if bikes are still docked)

**Tasks:**
| ID | Task | Assigned To | Estimate | Dependencies |
|----|------|-------------|----------|--------------|
| T-220 | Implement station CRUD admin API (reuse W-010 endpoints, add admin-only create/update/deactivate) | Bender | S | T-050, T-200 |
| T-221 | Build station management data table with search, sort, inline edit | Fry | L | T-201, T-220 |
| T-222 | Build "Add Station" form with map pin-drop for location selection | Fry | M | T-221, T-052 |
| T-223 | Add deactivation flow with confirmation dialog | Fry | S | T-221 |
| T-224 | Tests for station admin API (CRUD, deactivation with docked bikes) | Amy | S | T-220 |

**Priority:** P0

---

### US-026: Bike Management

**As an** admin, **I want to** view and manage all bikes in the fleet, **so that** I can handle maintenance and track individual bikes.

**Acceptance Criteria:**
- [ ] Data table: bike ID, model, battery %, status, current station, total rides, last maintenance date
- [ ] Filterable by status, station, battery threshold
- [ ] Update bike status: available → maintenance → retired (with confirmation)
- [ ] Assign/reassign bike to a station
- [ ] Bulk actions: select multiple bikes → set status (e.g., mark batch as maintenance)

**Tasks:**
| ID | Task | Assigned To | Estimate | Dependencies |
|----|------|-------------|----------|--------------|
| T-230 | Implement bike admin API: list with filters, update status, assign station, bulk update | Bender | M | T-050, T-200 |
| T-231 | Build bike management data table with filters and status update controls | Fry | L | T-201, T-230 |
| T-232 | Add bulk selection and bulk status update UI | Fry | M | T-231 |
| T-233 | Tests for bike admin API (filters, status transitions, bulk update) | Amy | M | T-230 |

**Priority:** P0

---

### US-027: User Management

**As a** support agent, **I want to** search for users and view their ride history, **so that** I can resolve support requests.

**Acceptance Criteria:**
- [ ] Searchable user table: name, email, registration date, total rides, account status
- [ ] Click user to view profile: personal info, ride history, active subscription, payment methods (masked), disputes
- [ ] Suspend/unsuspend user account (suspended users can't start rides)
- [ ] Issue manual refund for a specific ride
- [ ] Action audit log: who did what, when (visible to super_admin)

**Tasks:**
| ID | Task | Assigned To | Estimate | Dependencies |
|----|------|-------------|----------|--------------|
| T-240 | Implement user admin API: search, view detail (with rides), suspend/unsuspend, manual refund | Bender | M | T-200, T-170 |
| T-241 | Build user search and detail page: table, profile view, ride history tab | Fry | L | T-201, T-240 |
| T-242 | Add suspend/unsuspend and manual refund actions with confirmation dialogs | Fry | M | T-241 |
| T-243 | Tests for user admin API (search, suspend, refund) | Amy | M | T-240 |

**Priority:** P1

---

### US-028: Analytics Dashboard

**As an** operations manager, **I want to** see usage and revenue analytics, **so that** I can make data-driven decisions about fleet size and pricing.

**Acceptance Criteria:**
- [ ] Charts: rides per day (line chart), revenue per week (bar chart), average ride duration trend
- [ ] Station utilization: horizontal bar chart showing rides per station
- [ ] Peak hours: heatmap or bar chart showing ride starts by hour of day
- [ ] Fleet utilization rate: % of bikes used per day
- [ ] Date range selector (last 7d, 30d, 90d, custom)
- [ ] All data from API endpoints (not computed client-side)

**Tasks:**
| ID | Task | Assigned To | Estimate | Dependencies |
|----|------|-------------|----------|--------------|
| T-250 | Implement analytics API: rides over time, revenue over time, station utilization, peak hours, fleet utilization | Bender | L | T-100, T-120, T-200 |
| T-251 | Build analytics dashboard with Recharts: line chart (rides), bar chart (revenue), heatmap (peak hours) | Fry | L | T-201, T-250 |
| T-252 | Add date range selector and granularity toggle (daily/weekly/monthly) | Fry | S | T-251 |
| T-253 | Tests for analytics API: correct aggregations, date range filtering, empty data handling | Amy | M | T-250 |

**Priority:** P1

---

### US-029: Operational Alerts

**As an** operations manager, **I want to** receive alerts for critical fleet events, **so that** I can respond quickly to problems.

**Acceptance Criteria:**
- [ ] Alert triggers: bike battery < 15%, station full (0 docks), station empty (0 bikes), ride > 4 hours, bike overdue for maintenance
- [ ] Alerts displayed in admin dashboard: badge count in sidebar, alert list page
- [ ] Each alert: type, severity, timestamp, affected entity, acknowledge button
- [ ] Acknowledged alerts archived (not deleted)
- [ ] Alert count updates in real-time (via WebSocket or polling)

**Tasks:**
| ID | Task | Assigned To | Estimate | Dependencies |
|----|------|-------------|----------|--------------|
| T-260 | Implement alert service: detect conditions, create alert records, mark acknowledged | Bender | M | T-010, T-200 |
| T-261 | Add alert triggers: hook into ride start/end, bike status changes, periodic battery check | Bender | M | T-260, T-100 |
| T-262 | Build alerts page in admin: list with filters (type, severity, acknowledged), acknowledge action | Fry | M | T-201, T-260 |
| T-263 | Add alert badge count to admin sidebar (updates via polling or WS) | Fry | S | T-262 |
| T-264 | Tests for alert triggers and acknowledgment flow | Amy | M | T-260, T-261 |

**Priority:** P1

---

## Epic 8: Launch Readiness

> Polish, test, secure, deploy.

### US-030: Error Handling & Loading States

**As a** rider, **I want to** see clear feedback when things are loading or go wrong, **so that** I'm never confused about what the app is doing.

**Acceptance Criteria:**
- [ ] Global error boundary catches unhandled exceptions, shows friendly error page with retry
- [ ] API errors show contextual toast notifications (not generic "something went wrong")
- [ ] All async content has skeleton loaders (not spinners)
- [ ] Empty states for all lists (rides, stations, etc.) with helpful messaging
- [ ] Offline indicator when network is unavailable

**Tasks:**
| ID | Task | Assigned To | Estimate | Dependencies |
|----|------|-------------|----------|--------------|
| T-270 | Implement global error boundary and friendly error page | Fry | S | T-002 |
| T-271 | Build toast notification system wired to API client errors | Fry | S | T-042 |
| T-272 | Add skeleton loaders to all data-fetching components | Fry | M | All frontend components |
| T-273 | Add empty states to all list views (ride history, stations, admin tables) | Fry | M | All list components |
| T-274 | Add offline detection and indicator banner | Fry | S | T-002 |

**Priority:** P1

---

### US-031: Landing Page

**As a** potential rider visiting the site, **I want to** understand what the service is and how to get started, **so that** I sign up.

**Acceptance Criteria:**
- [ ] Public page (no auth required)
- [ ] Hero section: headline, subtext, "Get Started" CTA
- [ ] "How It Works" section: 3-step visual (Find → Unlock → Ride)
- [ ] Pricing section: pay-per-ride and subscription options
- [ ] Interactive station map preview (read-only, no auth)
- [ ] Footer: company info, terms, privacy policy links
- [ ] Mobile-responsive, < 2s load time

**Tasks:**
| ID | Task | Assigned To | Estimate | Dependencies |
|----|------|-------------|----------|--------------|
| T-280 | Build landing page: hero, how-it-works, pricing, station map preview, footer | Fry | L | T-052 |
| T-281 | Optimize landing page: lazy-load map, optimize images, ensure < 2s LCP | Fry | M | T-280 |
| T-282 | Add SEO meta tags, OG tags, robots.txt, sitemap | Fry | S | T-280 |

**Priority:** P1

---

### US-032: End-to-End Tests

**As a** team, **I want to** have automated E2E tests for critical user flows, **so that** we catch regressions before they reach production.

**Acceptance Criteria:**
- [ ] Playwright test suite covering critical flows:
  1. Sign up → verify email → login
  2. Add payment method → view saved cards
  3. Find station on map → open detail → unlock bike → ride → end ride → view receipt
  4. View ride history → download receipt
  5. Admin: login → view fleet → manage station → view analytics
- [ ] Tests run in CI on every PR
- [ ] Tests use seeded test data (no dependency on external services — Stripe mocked)
- [ ] All tests pass in < 3 minutes

**Tasks:**
| ID | Task | Assigned To | Estimate | Dependencies |
|----|------|-------------|----------|--------------|
| T-290 | Set up Playwright in project: config, test fixtures, page objects for common pages | Amy | M | T-001 |
| T-291 | E2E: Sign up → verify email → login → view dashboard | Amy | M | T-024, T-035 |
| T-292 | E2E: Add payment → find station → unlock bike → ride → end ride → view receipt | Amy | L | T-094, T-114, T-122 |
| T-293 | E2E: Admin login → fleet overview → manage station → manage bike → view analytics | Amy | L | T-201, T-211, T-221 |
| T-294 | Add E2E tests to CI pipeline (Playwright in GitHub Actions) | Amy | M | T-007, T-290 |

**Priority:** P0

---

### US-033: Security Audit

**As** the team lead, **I want to** verify the app is secure before launch, **so that** we don't expose user data or financial information.

**Acceptance Criteria:**
- [ ] Auth flows: no token leakage, no email enumeration, brute-force protection works
- [ ] RBAC: no privilege escalation (support agent can't access super_admin routes)
- [ ] Injection: no SQL injection, no XSS on any user input field
- [ ] Rate limiting: verified on all sensitive endpoints
- [ ] Dependencies: no known CVEs in production dependencies (`npm audit`)
- [ ] HTTPS enforced, cookies have correct flags (httpOnly, secure, sameSite)
- [ ] Stripe integration: verify no card data logged or stored

**Tasks:**
| ID | Task | Assigned To | Estimate | Dependencies |
|----|------|-------------|----------|--------------|
| T-300 | Audit auth: token storage, refresh flow, brute-force protection, session fixation | Leela | M | T-033 |
| T-301 | Audit RBAC: test every admin endpoint with every role, verify 403/404 behavior | Leela | M | T-200 |
| T-302 | Audit input handling: test all user-input endpoints for XSS and injection | Leela | M | All API endpoints |
| T-303 | Run `npm audit`, resolve critical/high vulnerabilities | Leela | S | T-001 |
| T-304 | Verify Stripe integration: no PAN logging, proper webhook signature validation | Leela | S | T-120 |

**Priority:** P0

---

### US-034: Performance Audit

**As** the team lead, **I want to** verify the app meets performance targets, **so that** riders have a fast, responsive experience.

**Acceptance Criteria:**
- [ ] Lighthouse score ≥ 90 on landing page and main app pages
- [ ] Bundle size: main JS bundle < 200KB gzipped
- [ ] All routes lazy-loaded (code splitting)
- [ ] Map tile loading optimized (vector tiles, appropriate zoom limits)
- [ ] API p95 latency < 200ms on all CRUD endpoints (verified with load test)
- [ ] Image optimization: WebP format, responsive sizing

**Tasks:**
| ID | Task | Assigned To | Estimate | Dependencies |
|----|------|-------------|----------|--------------|
| T-310 | Run Lighthouse audit, document results, identify top issues | Leela | S | All frontend |
| T-311 | Implement route-level code splitting and lazy loading | Fry | M | All frontend routes |
| T-312 | Bundle analysis: identify large dependencies, evaluate tree-shaking opportunities | Leela | S | T-311 |
| T-313 | Load test API endpoints (k6 or Artillery): verify p95 < 200ms under 100 concurrent users | Leela | M | All API endpoints |

**Priority:** P1

---

### US-035: Deployment & Infrastructure

**As** the team, **I want to** have production environments configured with automated deploys, **so that** we can ship reliably.

**Acceptance Criteria:**
- [ ] Frontend deployed to Vercel with automatic deploys from `main` branch
- [ ] Backend deployed to Railway or Render with automatic deploys from `main` branch
- [ ] Managed PostgreSQL provisioned with daily backups
- [ ] Redis provisioned for session/cache
- [ ] Environment variables configured via provider secrets management (not committed)
- [ ] Preview environments for PRs (Vercel preview deploys)
- [ ] Sentry configured for error tracking in production
- [ ] Health check endpoint (`/api/health`) returns 200

**Tasks:**
| ID | Task | Assigned To | Estimate | Dependencies |
|----|------|-------------|----------|--------------|
| T-320 | Configure Vercel project for frontend: build settings, env vars, custom domain | Leela | M | T-002 |
| T-321 | Configure Railway/Render for backend: build command, env vars, health check, auto-deploy | Leela | M | T-003 |
| T-322 | Provision managed PostgreSQL + Redis; configure connection strings | Leela | S | T-321 |
| T-323 | Implement `/api/health` endpoint checking DB and Redis connectivity | Bender | S | T-003 |
| T-324 | Configure Sentry: install SDK in frontend and backend, set up source maps | Leela | M | T-320, T-321 |
| T-325 | Test full deploy pipeline: push to main → both apps deploy → smoke test passes | Leela | M | T-320, T-321 |

**Priority:** P0

---

## Sprint Plan

### Sprint 1: Foundation + Auth + Discovery (Weeks 1–2)

**Goal:** Users can sign up, log in, and see bikes on a map.

| Story | Priority | Key Deliverables |
|-------|----------|------------------|
| US-001 | P0 | Monorepo scaffolded, tooling configured |
| US-002 | P0 | CI pipeline running on PRs |
| US-003 | P0 | Database schema + seed data |
| US-004 | P0 | Registration (backend + frontend) |
| US-005 | P0 | Login, session management, protected routes |
| US-006 | P0 | Typed API client with auth interceptors |
| US-007 | P0 | Interactive station map with real data |
| US-008 | P0 | Station detail panel with bike battery info |

**Exit Criteria:** A new user can register, log in, see a map of stations, and tap a station to see available bikes.

**Parallel Tracks:**
- Leela: T-001, T-005–T-009 (scaffolding, CI)
- Bender: T-003–T-004, T-010–T-013, T-020–T-023, T-050–T-051, T-060 (backend infra, APIs)
- Fry: T-002, T-024–T-025, T-035–T-037, T-040–T-042, T-052–T-053, T-061–T-062 (frontend)
- Amy: T-026–T-027, T-038–T-039, T-054–T-055, T-063 (tests)

---

### Sprint 2: Rental Flow + Payments (Weeks 3–4)

**Goal:** Users can rent a bike, ride, return it, and pay.

| Story | Priority | Key Deliverables |
|-------|----------|------------------|
| US-011 | P0 | QR scanner + bike unlock |
| US-012 | P0 | Active ride screen with live timer and cost |
| US-013 | P0 | End ride, payment capture, receipt |
| US-014 | P0 | Ride summary and receipt display |
| US-016 | P0 | Payment method management (Stripe Elements) |
| US-017 | P0 | Pay-per-ride pricing engine + pre-auth |
| US-020 | P0 | Ride history list and detail |

**Exit Criteria:** A rider can complete the full loop — find bike → scan QR → unlock → ride → end → pay → view receipt — and see their ride history.

**Parallel Tracks:**
- Bender: T-092–T-093, T-100–T-101, T-110–T-113, T-120–T-121, T-130–T-133, T-170 (ride service, payments, IoT)
- Fry: T-090–T-091, T-094, T-102–T-103, T-114, T-117–T-118, T-122, T-134, T-171–T-172 (ride UI, payment UI)
- Amy: T-095–T-096, T-104–T-105, T-115–T-116, T-119, T-123, T-135–T-136, T-173–T-174 (tests)
- Leela: Code review, architecture guidance

---

### Sprint 3: Admin Dashboard + Subscriptions (Weeks 5–6)

**Goal:** Admins can manage the fleet. Riders can subscribe.

| Story | Priority | Key Deliverables |
|-------|----------|------------------|
| US-023 | P0 | Admin layout + RBAC |
| US-024 | P0 | Fleet overview map |
| US-025 | P0 | Station management CRUD |
| US-026 | P0 | Bike management CRUD |
| US-018 | P1 | Subscription plans |
| US-010 | P1 | Real-time station availability |
| US-015 | P1 | Bike reservations |

**Exit Criteria:** Admin can log in, see fleet on map, manage stations and bikes. Riders can subscribe to monthly plan and see real-time availability.

**Parallel Tracks:**
- Bender: T-200, T-210, T-220, T-230, T-080–T-081, T-140–T-142, T-150–T-151 (admin APIs, WebSocket, subscriptions)
- Fry: T-201–T-202, T-211–T-212, T-221–T-223, T-231–T-232, T-082–T-084, T-143, T-152–T-153 (admin UI, real-time, reservation UI)
- Amy: T-203, T-213, T-224, T-233, T-085, T-144, T-154–T-155 (tests)
- Leela: Code review, RBAC design guidance

---

### Sprint 4: Polish + History + Alerts + Launch Prep (Weeks 7–8)

**Goal:** Ship-ready product with E2E tests, security audit, and production deployment.

| Story | Priority | Key Deliverables |
|-------|----------|------------------|
| US-009 | P1 | Station list view (accessibility) |
| US-021 | P1 | Receipt export (PDF, CSV) |
| US-022 | P1 | Dispute flow |
| US-027 | P1 | User management (admin) |
| US-028 | P1 | Analytics dashboard |
| US-029 | P1 | Operational alerts |
| US-030 | P1 | Error handling + loading states |
| US-031 | P1 | Landing page |
| US-032 | P0 | E2E test suite |
| US-033 | P0 | Security audit |
| US-034 | P1 | Performance audit |
| US-035 | P0 | Production deployment |

**Exit Criteria:** All P0 and P1 stories complete. E2E tests passing. Security audit clean. App deployed to production. Landing page live.

**Parallel Tracks:**
- Bender: T-180–T-182, T-190–T-191, T-240, T-250, T-260–T-261, T-323 (exports, disputes, analytics, alerts)
- Fry: T-070–T-071, T-183, T-192–T-193, T-241–T-242, T-251–T-252, T-262–T-263, T-270–T-274, T-280–T-282, T-311 (UI polish, admin pages, landing)
- Amy: T-072, T-184, T-194, T-243, T-253, T-264, T-290–T-294 (tests, E2E suite)
- Leela: T-300–T-304, T-310, T-312–T-313, T-320–T-322, T-324–T-325 (audits, deployment)

---

### Backlog (Post Sprint 4)

| Story | Priority | Notes |
|-------|----------|-------|
| US-019 | P2 | Promo codes — nice to have for launch |
| Additional P2 items from PRD | P2 | SEO, further polish |
| Native mobile apps | Post-MVP | After validation |
| Multi-city support | Post-MVP | Architecture supports it, build when needed |

---

## Dependency Graph

```
US-001 (Scaffolding) ─────────────────────────────────────────┐
├── US-002 (CI/CD)                                            │
├── US-003 (DB Schema) ──────────────────────────────────┐    │
│   ├── US-007 (Station Map) ──── US-008 (Station Detail) │    │
│   │   ├── US-009 (Station List)                         │    │
│   │   ├── US-010 (Real-time)                            │    │
│   │   └── US-024 (Fleet Overview)                       │    │
│   ├── US-012 (Active Ride) ─── US-013 (End Ride)        │    │
│   │   ├── US-014 (Ride Summary)                         │    │
│   │   ├── US-015 (Reservation)                          │    │
│   │   └── US-020 (Ride History)                         │    │
│   │       ├── US-021 (Receipt Export)                   │    │
│   │       └── US-022 (Dispute)                          │    │
│   └── US-029 (Alerts)                                   │    │
├── US-004 (Registration) ─── US-005 (Login) ─────────────┤    │
│   ├── US-016 (Payment Methods) ─── US-017 (Per-Ride)    │    │
│   │   ├── US-018 (Subscriptions)                        │    │
│   │   └── US-019 (Promo Codes)                          │    │
│   └── US-023 (Admin RBAC) ──────────────────────────────┤    │
│       ├── US-025 (Station Mgmt)                         │    │
│       ├── US-026 (Bike Mgmt)                            │    │
│       ├── US-027 (User Mgmt)                            │    │
│       └── US-028 (Analytics)                            │    │
├── US-006 (API Client) ─── US-011 (Unlock Bike)          │    │
│                                                          │    │
├── US-030 (Error Handling) ← all frontend stories         │    │
├── US-031 (Landing Page) ← US-007                         │    │
├── US-032 (E2E Tests) ← all P0 stories                   │    │
├── US-033 (Security Audit) ← all P0 stories               │    │
├── US-034 (Performance Audit) ← all frontend stories      │    │
└── US-035 (Deployment) ← US-002                           │
                                                            │
```

### Critical Path

The longest dependency chain determines minimum calendar time:

```
US-001 → US-003 → US-004 → US-005 → US-016 → US-017 → US-012 → US-013 → US-032 → US-035
(scaffold) (DB)    (register) (login)  (payment) (pricing) (ride)   (end)    (E2E)    (deploy)
```

This chain spans all 4 sprints. Parallelizing discovery (US-007/008) alongside auth (US-004/005) in Sprint 1 is critical to keeping Sprint 2 unblocked.

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Epics | 8 |
| User Stories | 35 |
| Tasks | 160+ |
| P0 Stories | 19 |
| P1 Stories | 14 |
| P2 Stories | 2 |
| Sprints | 4 (8 weeks) |

---

*This document is the execution plan for the PRD. Every task traces to a user story, every story traces to a PRD feature area. If a task isn't here, we're not doing it yet.*
