# Product Requirements Document — EV Bike Rental

**Version:** 1.0
**Author:** Leela (Lead)
**Date:** 2025-07-25
**Status:** Draft

---

## 1. Overview

### What It Is

EV Bike Rental is a web application that lets people rent electric bikes from docking stations across a city. Riders find nearby bikes, unlock them with a tap, ride wherever they need to go, and dock at any station when they're done. The app handles everything — discovery, unlock, payment, and ride history.

### Who It's For

- **Commuters** who need reliable last-mile transportation
- **Tourists and casual riders** exploring a city
- **City operators and fleet managers** running the bike-share program

### Core Value Proposition

Affordable, zero-emission urban mobility — available on demand, no ownership required. For operators: a turnkey platform to launch and manage an EV bike-share fleet with real-time visibility into every bike, station, and ride.

---

## 2. User Personas

### Rider — "Alex"

- **Who:** Urban commuter, 25–40, uses transit daily
- **Goal:** Get from the train station to the office in under 10 minutes without breaking a sweat
- **Pain Points:** Unreliable bike availability, clunky unlock flows, surprise charges
- **Needs:** Fast bike discovery, one-tap unlock, transparent pricing, reliable battery levels

### Casual Rider — "Sam"

- **Who:** Tourist or weekend rider, 20–55, occasional user
- **Goal:** Explore the city at their own pace
- **Pain Points:** Confusing pricing, not knowing where to return bikes, range anxiety
- **Needs:** Clear station map, estimated range display, simple one-time payment

### Admin — "Jordan"

- **Who:** Fleet operations manager for the bike-share company
- **Goal:** Keep bikes available, maintained, and generating revenue
- **Pain Points:** Bikes stuck at full stations, dead batteries in the field, no visibility into fleet health
- **Needs:** Real-time fleet dashboard, maintenance alerts, usage analytics, station management

### Station Operator — "Pat" (Post-MVP)

- **Who:** On-the-ground technician responsible for specific stations
- **Goal:** Keep assigned stations stocked and bikes charged
- **Pain Points:** No prioritized task list, manual counting of bikes
- **Needs:** Mobile-friendly station view, maintenance task queue

---

## 3. Core Features (MVP)

### 3.1 User Registration & Authentication

| Aspect | Detail |
|--------|--------|
| **Sign-up** | Email + password, or OAuth (Google, Apple) |
| **Login** | Email/password, OAuth, magic link |
| **Profile** | Name, email, phone, payment method on file |
| **Verification** | Email verification required before first ride |
| **Session** | JWT-based auth with refresh tokens; 30-day session, 15-min access token |

### 3.2 Bike Discovery

| Aspect | Detail |
|--------|--------|
| **Map View** | Interactive map (Mapbox GL JS) showing all stations with bike/dock availability |
| **Station Markers** | Color-coded: green (bikes available), yellow (low), red (empty), blue (selected) |
| **Station Detail** | Tap a station to see: available bikes, empty docks, each bike's battery level, distance from user |
| **List View** | Sortable list of nearby stations (distance, availability) for accessibility |
| **Search** | Search stations by name or address |
| **Real-Time Updates** | Station availability updates via WebSocket every 30 seconds |
| **Geolocation** | Auto-center map on user location with permission |

### 3.3 Bike Rental Flow

| Step | Detail |
|------|--------|
| **1. Select** | Rider taps a station, sees available bikes with battery % |
| **2. Reserve (optional)** | Reserve a specific bike for up to 10 minutes (prevents others from taking it) |
| **3. Unlock** | Scan QR code on bike OR tap "Unlock" in app → sends unlock command to bike via IoT API |
| **4. Ride** | Timer starts. App shows elapsed time, estimated cost, and map with nearby return stations |
| **5. Return** | Rider docks bike at any station with open docks. Bike auto-locks on dock. App confirms return. |
| **6. Receipt** | Ride summary: duration, distance (if GPS available), cost, start/end stations |

**Edge Cases:**
- Bike won't unlock → show error, suggest adjacent bike, auto-release reservation
- No docks at destination → show nearest stations with open docks, allow out-of-dock return for a surcharge
- Ride exceeds 4 hours → auto-escalate to daily rate, send push notification at 3h mark
- Lost connection mid-ride → ride continues; sync on reconnect

### 3.4 Payment & Pricing

| Aspect | Detail |
|--------|--------|
| **Pricing Model** | Pay-per-ride: $1 to unlock + $0.15/minute. First 30 minutes included in subscription plans. |
| **Subscriptions** | Monthly ($14.99/mo — 30 min/ride included, reduced per-min rate of $0.08). Annual ($119.99/yr — same benefits). |
| **Payment Methods** | Credit/debit card (Stripe), Apple Pay, Google Pay |
| **Authorization** | Pre-auth hold of $25 at ride start; charge actual amount on ride end |
| **Receipts** | Auto-emailed after each ride; available in-app under Ride History |
| **Promotions** | Promo code system for discounts (e.g., first ride free, referral credits) |
| **Wallet** | In-app wallet with top-up for faster checkout (Post-MVP) |

### 3.5 Ride History & Receipts

| Aspect | Detail |
|--------|--------|
| **History List** | Chronological list of all past rides with date, duration, cost, start/end station |
| **Ride Detail** | Tap a ride to see full receipt: route map (if GPS data), duration breakdown, charges |
| **Export** | Download receipt as PDF; export all rides as CSV (for expense reports) |
| **Disputes** | "Report an issue" button on each ride — opens support form |

### 3.6 Admin Dashboard

| Feature | Detail |
|---------|--------|
| **Fleet Overview** | Map view of all stations + bikes. Real-time status: in-use, available, maintenance, low-battery |
| **Station Management** | CRUD for stations: name, location (lat/lng), dock count, operational status |
| **Bike Management** | CRUD for bikes: ID, model, battery level, maintenance status, current station, total rides |
| **User Management** | View users, ride history, account status. Suspend/ban users. Issue refunds. |
| **Pricing Management** | Configure pricing tiers, subscription plans, promo codes |
| **Analytics** | Rides per day/week/month, revenue, average ride duration, peak hours, station utilization, fleet utilization rate |
| **Alerts** | Low battery alerts, station full/empty alerts, bikes not returned >4h, maintenance overdue |
| **Role-Based Access** | Super Admin (full access), Operations Manager (fleet + stations), Support Agent (users + rides) |

---

## 4. Technical Requirements

### 4.1 Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | React 18+ with TypeScript | Component-driven, large ecosystem, strong typing |
| **UI Framework** | Tailwind CSS + shadcn/ui | Utility-first, consistent design system, accessible components |
| **State Management** | Zustand or React Query (TanStack Query) | Lightweight, server-state focused |
| **Maps** | Mapbox GL JS | Best-in-class for interactive maps, customizable styling, good free tier |
| **Backend** | Node.js with Express or Fastify, TypeScript | Same language as frontend, fast I/O, mature ecosystem |
| **API Style** | REST (JSON) for CRUD, WebSocket for real-time updates | REST for simplicity; WS for live station data |
| **Database** | PostgreSQL 15+ | Relational integrity for financial data, PostGIS for geospatial queries |
| **ORM** | Prisma | Type-safe queries, excellent migration tooling, good DX |
| **Cache** | Redis | Session store, rate limiting, real-time availability cache |
| **Auth** | JWT (access + refresh tokens) with bcrypt password hashing | Stateless auth, industry standard |
| **Payments** | Stripe API | PCI-compliant, pre-auth support, subscription billing, global coverage |
| **File Storage** | AWS S3 or Cloudflare R2 | Receipts, profile images, export files |
| **Hosting** | Vercel (frontend) + Railway or Render (backend) | Low-ops for MVP, easy to scale later |
| **CI/CD** | GitHub Actions | Already in the repo, automate tests + deploys |
| **Monitoring** | Sentry (errors) + basic structured logging | Catch issues fast without overengineering |

### 4.2 Key Integrations

| Integration | Purpose | Notes |
|-------------|---------|-------|
| **Mapbox** | Map rendering, geocoding, directions | Free tier: 50K map loads/mo |
| **Stripe** | Payments, subscriptions, refunds | Use Payment Intents API for pre-auth |
| **IoT Bike Lock API** | Unlock/lock bikes remotely | Abstracted behind an interface — vendor TBD. Mock for MVP. |
| **Email (SendGrid or Resend)** | Verification emails, receipts, alerts | Transactional email only |
| **Push Notifications** | Ride reminders, promo alerts | Web Push API (service worker) for MVP; native push post-MVP |

### 4.3 Data Model (Core Entities)

```
User { id, email, name, phone, passwordHash, role, stripeCustomerId, createdAt }
Station { id, name, lat, lng, address, totalDocks, status, createdAt }
Bike { id, model, batteryLevel, status[available|in_use|maintenance|retired], stationId?, createdAt }
Ride { id, userId, bikeId, startStationId, endStationId?, startTime, endTime?, durationMin, distanceKm?, cost, status[active|completed|disputed], createdAt }
Payment { id, rideId?, userId, amount, currency, stripePaymentIntentId, type[ride|subscription|refund], status, createdAt }
Subscription { id, userId, plan[monthly|annual], stripeSubscriptionId, status, startDate, endDate }
Reservation { id, userId, bikeId, stationId, expiresAt, status[active|used|expired|cancelled], createdAt }
PromoCode { id, code, discountType[percentage|fixed], discountValue, maxUses, usesCount, expiresAt }
```

---

## 5. Non-Functional Requirements

### 5.1 Performance

- **Page Load:** < 2s initial load (LCP), < 100ms interaction response (INP)
- **Map Render:** < 1s for initial map with stations
- **API Response:** < 200ms for 95th percentile on CRUD endpoints
- **Unlock Latency:** < 3s from tap to bike unlock confirmation (critical UX metric)
- **WebSocket:** Station availability updates delivered within 5s of change

### 5.2 Security

- HTTPS everywhere (TLS 1.3)
- Passwords hashed with bcrypt (cost factor 12)
- JWT stored in httpOnly cookies (not localStorage)
- CSRF protection on state-changing endpoints
- Rate limiting: 100 req/min per IP (general), 10 req/min on auth endpoints
- PCI compliance via Stripe (no card numbers touch our servers)
- Input validation on all API endpoints (Zod schemas)
- SQL injection prevention via parameterized queries (Prisma handles this)
- RBAC enforced at API layer, not just UI

### 5.3 Scalability

- Stateless backend → horizontally scalable behind a load balancer
- Database connection pooling (PgBouncer or Prisma connection pool)
- Redis for caching hot data (station availability, session tokens)
- CDN for static assets (Vercel handles this for frontend)
- Target: support 10K concurrent riders for MVP city launch

### 5.4 Mobile-First

- Responsive design: mobile-first breakpoints (375px → 768px → 1024px → 1440px)
- Touch-optimized: minimum 44px tap targets
- Offline-capable: service worker caches map tiles and last-known station data
- Camera access for QR code scanning (WebRTC/MediaDevices API)

### 5.5 Accessibility

- WCAG 2.1 AA compliance
- Keyboard navigable
- Screen reader compatible (proper ARIA labels)
- Color contrast ratios ≥ 4.5:1
- List view as accessible alternative to map view

### 5.6 Reliability

- 99.5% uptime target
- Graceful degradation: if WebSocket fails, fall back to polling
- Ride state persisted server-side — no data loss on client crash
- Idempotent payment operations (no double charges)

---

## 6. Future Features (Post-MVP)

| Feature | Description | Priority |
|---------|-------------|----------|
| **Native Mobile Apps** | iOS and Android apps (React Native) for better UX, native push, background GPS | High |
| **Fleet Rebalancing AI** | Predictive model to suggest where to move bikes based on demand patterns | Medium |
| **Multi-City Support** | Tenant-based architecture for multiple city deployments | High |
| **Gamification** | Badges, streaks, leaderboards to drive engagement (e.g., "Green Commuter" badge) | Low |
| **Corporate Accounts** | Employer-sponsored plans with consolidated billing | Medium |
| **In-App Wallet** | Pre-loaded wallet for faster checkout, promotional credits | Medium |
| **Station Operator App** | Dedicated mobile view for ground-level station maintenance staff | Medium |
| **Dynamic Pricing** | Surge pricing during peak hours, discounts for returning to low-stock stations | Medium |
| **Bike Health Telemetry** | Real-time diagnostics from bike sensors (brake wear, tire pressure, motor health) | Low |
| **Trip Planner** | Route suggestions with elevation, ETA, and battery-range feasibility | Low |
| **Referral Program** | Invite friends → both get ride credits | Medium |
| **Multi-Language Support** | i18n for tourist-heavy cities | Medium |

---

## 7. Success Metrics

### Rider Metrics

| KPI | Target (3 months post-launch) |
|-----|-------------------------------|
| **Registered Users** | 5,000 |
| **Monthly Active Riders** | 1,500 |
| **Rides per Day** | 300 |
| **Average Ride Duration** | 12–18 minutes |
| **Repeat Rider Rate** | 40% ride again within 7 days |
| **Subscription Conversion** | 10% of active riders on a paid plan |

### Operational Metrics

| KPI | Target |
|-----|--------|
| **Fleet Utilization** | 4+ rides per bike per day |
| **Bike Availability** | 90% of stations have ≥1 bike available at any time |
| **Unlock Success Rate** | > 98% |
| **Average Unlock Time** | < 3 seconds |
| **Support Tickets per 100 Rides** | < 2 |

### Business Metrics

| KPI | Target |
|-----|--------|
| **Revenue per Ride** | $3.50 average |
| **Monthly Recurring Revenue** | $10,000 by month 3 |
| **Customer Acquisition Cost** | < $5 per rider |
| **Ride Dispute Rate** | < 1% |

---

## 8. Work Items

The MVP is broken into discrete work items. Each item is scoped to be completable in 1–3 days and reviewable in under 15 minutes.

### Legend

- **Agent:** Fry (Frontend), Bender (Backend), Amy (Tests), Leela (Architecture/Review)
- **Priority:** P0 = must ship, P1 = should ship, P2 = nice to have
- **Status:** Not Started

### 8.1 Foundation

| ID | Title | Description | Agent | Dependencies | Priority |
|----|-------|-------------|-------|--------------|----------|
| W-001 | Project scaffolding | Initialize monorepo structure: `/apps/web` (React + Vite + TS), `/apps/api` (Node + Express/Fastify + TS), `/packages/shared` (types, constants). Configure ESLint, Prettier, TypeScript tsconfig. | Leela | — | P0 |
| W-002 | Database schema & migrations | Define Prisma schema for all core entities (User, Station, Bike, Ride, Payment, Subscription, Reservation, PromoCode). Run initial migration. Seed script with sample data. | Bender | W-001 | P0 |
| W-003 | Auth module (backend) | Implement registration (email+password), login, JWT issuance (access + refresh), token refresh, logout, email verification flow. Middleware for protected routes. | Bender | W-002 | P0 |
| W-004 | Auth module (frontend) | Sign-up, login, and forgot-password pages. Auth context/provider. Protected route wrapper. Token refresh interceptor in API client. | Fry | W-003 | P0 |
| W-005 | API client setup | Create typed API client (Axios or fetch wrapper) with interceptors for auth tokens, error handling, and base URL configuration. Shared between all frontend features. | Fry | W-001 | P0 |
| W-006 | CI pipeline | GitHub Actions workflow: lint, type-check, test, build on every PR. Separate jobs for frontend and backend. | Leela | W-001 | P0 |
| W-007 | Auth tests | Unit tests for auth service (registration, login, token refresh, validation). Integration tests for auth API endpoints. | Amy | W-003 | P0 |

### 8.2 Bike Discovery

| ID | Title | Description | Agent | Dependencies | Priority |
|----|-------|-------------|-------|--------------|----------|
| W-010 | Station CRUD API | REST endpoints for stations: list all (with geospatial proximity query), get by ID, create, update, delete. Include available bike count and empty dock count in response. | Bender | W-002 | P0 |
| W-011 | Bike CRUD API | REST endpoints for bikes: list (filterable by station, status), get by ID, create, update status, retire. | Bender | W-002 | P0 |
| W-012 | Map view component | Interactive Mapbox map centered on user location. Render station markers with color-coded availability. Tap marker to open station detail panel. | Fry | W-005, W-010 | P0 |
| W-013 | Station detail panel | Slide-up panel showing station info: name, address, available bikes (with battery %), empty docks, distance from user. "Reserve" and "Unlock" CTAs. | Fry | W-012 | P0 |
| W-014 | Station list view | Sortable, filterable list of nearby stations as accessible alternative to map. Distance, bike count, dock count columns. | Fry | W-010 | P1 |
| W-015 | Real-time availability | WebSocket endpoint that broadcasts station availability changes. Frontend subscribes on map mount, updates markers live. Fallback to 30s polling. | Bender | W-010 | P1 |
| W-016 | Discovery tests | Tests for station/bike API endpoints (CRUD, geospatial queries). Frontend component tests for map and list views. | Amy | W-010, W-011, W-012 | P0 |

### 8.3 Rental Flow

| ID | Title | Description | Agent | Dependencies | Priority |
|----|-------|-------------|-------|--------------|----------|
| W-020 | Ride service (backend) | Core ride lifecycle: start ride (create Ride record, mark bike as in_use, trigger unlock), end ride (calculate duration + cost, mark bike available, dock at station), cancel. Enforce business rules (one active ride per user, valid bike status). | Bender | W-002, W-011 | P0 |
| W-021 | IoT lock interface | Abstract interface for bike lock hardware. Mock implementation that simulates unlock/lock with 1s delay. Ready to swap in real vendor SDK later. | Bender | W-001 | P0 |
| W-022 | Reservation service | Reserve a bike for up to 10 minutes. Expire stale reservations via cron job (or pg_cron). Cancel reservation on ride start or timeout. | Bender | W-020 | P1 |
| W-023 | QR code scanner | Camera-based QR scanner component (using `html5-qrcode` library). Scans bike QR code → extracts bike ID → triggers unlock flow. | Fry | W-005 | P0 |
| W-024 | Active ride screen | Full-screen ride-in-progress view: elapsed timer, running cost estimate, map showing nearby return stations, "End Ride" button. | Fry | W-020, W-012 | P0 |
| W-025 | Ride summary screen | Post-ride receipt: duration, distance, cost breakdown, start/end stations, "Report Issue" link. | Fry | W-020 | P0 |
| W-026 | Rental flow tests | Unit tests for ride service (start, end, edge cases). Integration tests for full rental lifecycle. Frontend tests for QR scanner and ride screens. | Amy | W-020, W-023, W-024 | P0 |

### 8.4 Payments

| ID | Title | Description | Agent | Dependencies | Priority |
|----|-------|-------------|-------|--------------|----------|
| W-030 | Stripe integration | Integrate Stripe: create customer on registration, save payment methods, create payment intents with pre-auth, capture on ride end, handle webhooks for async events. | Bender | W-003 | P0 |
| W-031 | Pricing engine | Calculate ride cost based on duration and user's plan (pay-per-ride vs subscription). Apply promo codes. Return cost breakdown. Configurable pricing tiers (admin-editable). | Bender | W-020 | P0 |
| W-032 | Payment method UI | Add/remove payment methods (Stripe Elements). Show saved cards. Set default payment method. | Fry | W-030 | P0 |
| W-033 | Subscription management | Subscribe/cancel/change plan. Show current plan status and renewal date. Integrate with Stripe Billing. | Bender | W-030 | P1 |
| W-034 | Subscription UI | Plan comparison page, subscribe CTA, manage subscription page (current plan, cancel, change). | Fry | W-033 | P1 |
| W-035 | Promo code system | CRUD API for promo codes (admin). Apply promo code at checkout. Validate: not expired, not maxed out, not already used by this user. | Bender | W-031 | P2 |
| W-036 | Payment tests | Unit tests for pricing engine (all plan types, promo codes, edge cases). Integration tests for Stripe payment flow (using Stripe test mode). | Amy | W-030, W-031 | P0 |

### 8.5 Ride History

| ID | Title | Description | Agent | Dependencies | Priority |
|----|-------|-------------|-------|--------------|----------|
| W-040 | Ride history API | Paginated endpoint: list user's rides with filters (date range, status). Ride detail endpoint with full cost breakdown. | Bender | W-020 | P0 |
| W-041 | Ride history UI | Paginated list of past rides (date, duration, cost, stations). Tap to view ride detail with receipt. | Fry | W-040 | P0 |
| W-042 | Receipt export | Generate PDF receipt for a single ride. CSV export of all rides (date range filter). Serve via signed S3 URL. | Bender | W-040 | P1 |
| W-043 | Dispute flow | "Report Issue" on ride detail → form (reason dropdown + free text) → creates support ticket in DB. Admin can view and resolve disputes. | Bender | W-040 | P1 |
| W-044 | History tests | Tests for ride history API (pagination, filters). Tests for receipt generation. | Amy | W-040, W-042 | P0 |

### 8.6 Admin Dashboard

| ID | Title | Description | Agent | Dependencies | Priority |
|----|-------|-------------|-------|--------------|----------|
| W-050 | Admin layout & RBAC | Admin route group with role-based access control. Layout: sidebar navigation, header with user info. Roles: super_admin, ops_manager, support_agent. | Fry | W-003, W-004 | P0 |
| W-051 | Fleet overview map | Admin map view showing all bikes (color by status) and stations. Click bike/station for detail panel. Filter by status. | Fry | W-012, W-050 | P0 |
| W-052 | Station management page | Data table of all stations with inline edit. Create new station (form with map pin drop for lat/lng). Toggle station active/inactive. | Fry | W-010, W-050 | P0 |
| W-053 | Bike management page | Data table of all bikes with filters (status, station, battery). Update bike status (available, maintenance, retired). Assign bike to station. | Fry | W-011, W-050 | P0 |
| W-054 | User management page | Searchable user table. View user profile and ride history. Suspend/unsuspend user. Issue manual refund. | Fry | W-040, W-050 | P1 |
| W-055 | Analytics dashboard | Charts: rides per day (line), revenue per week (bar), peak hours heatmap, station utilization (bar). Use Recharts or Chart.js. Data served by analytics API endpoints. | Fry | W-050 | P1 |
| W-056 | Analytics API | Aggregate endpoints: rides over time, revenue over time, top stations, fleet utilization, average ride duration. Support date range and granularity params. | Bender | W-020, W-030 | P1 |
| W-057 | Alert system | Backend: detect low battery (<15%), station full/empty, ride >4h. Surface alerts in admin dashboard. Mark as acknowledged. | Bender | W-002 | P1 |
| W-058 | Admin tests | Tests for RBAC middleware. Tests for admin CRUD operations. Tests for analytics endpoints. | Amy | W-050, W-056 | P0 |

### 8.7 Polish & Launch Prep

| ID | Title | Description | Agent | Dependencies | Priority |
|----|-------|-------------|-------|--------------|----------|
| W-060 | Error handling & loading states | Global error boundary, API error toasts, skeleton loaders for all async content, empty states for lists. | Fry | W-005 | P1 |
| W-061 | Responsive design pass | Ensure all pages work on 375px–1440px. Test on iOS Safari, Android Chrome. Fix any overflow/touch issues. | Fry | All frontend items | P1 |
| W-062 | SEO & meta tags | Proper title, description, OG tags for public pages (landing, pricing). Robots.txt, sitemap. | Fry | W-001 | P2 |
| W-063 | Landing page | Public landing page: hero, how it works, pricing, download CTA, station map preview. | Fry | W-012 | P1 |
| W-064 | E2E tests | Playwright end-to-end tests for critical flows: sign up → add payment → rent bike → end ride → view history. | Amy | All P0 items | P0 |
| W-065 | Performance audit | Lighthouse audit, bundle analysis, lazy-load routes, optimize map tile loading, image optimization. Target: 90+ Lighthouse score. | Leela | All frontend items | P1 |
| W-066 | Security audit | Pen-test auth flows, validate RBAC, check for injection vectors, verify rate limiting, audit dependencies for CVEs. | Leela | All P0 items | P0 |
| W-067 | Deployment setup | Configure production environments: Vercel (frontend), Railway/Render (backend), managed Postgres, Redis. Environment variables, secrets management. | Leela | W-006 | P0 |

---

## Appendix A: Dependency Graph (Simplified)

```
W-001 (Scaffolding)
├── W-002 (DB Schema) ──┬── W-010 (Station API) ──── W-012 (Map View) ──── W-013 (Detail Panel)
│                       ├── W-011 (Bike API) ────── W-053 (Bike Mgmt)
│                       ├── W-020 (Ride Service) ─── W-024 (Active Ride)
│                       │   └── W-031 (Pricing) ─── W-036 (Payment Tests)
│                       └── W-057 (Alerts)
├── W-003 (Auth BE) ────┬── W-004 (Auth FE)
│                       ├── W-030 (Stripe) ────── W-032 (Payment UI)
│                       └── W-007 (Auth Tests)
├── W-005 (API Client) ─── W-023 (QR Scanner)
├── W-006 (CI Pipeline)
└── W-021 (IoT Interface)
```

## Appendix B: Open Questions

1. **IoT Vendor:** Which bike lock hardware/API will we integrate with? (Mocked for MVP — decision needed before pilot.)
2. **Deployment Region:** Single region (closest to launch city) or multi-region from day one?
3. **Native Apps Timeline:** When do we start React Native work? After MVP validation or in parallel?
4. **Operational Staffing:** Will station operators use this app or a separate tool?
5. **Legal:** Terms of service, liability waivers, data privacy policy (GDPR?) — need legal review before launch.

---

*This document is the source of truth for what we're building. All implementation work should trace back to a work item here. If it's not in the PRD, we're not building it yet.*
