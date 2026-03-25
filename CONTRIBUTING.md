# Contributing to EV Bike Rental

## Getting Started

```bash
git clone https://github.com/ilyas-it83/EVBikeRental.git
cd EVBikeRental
npm install --legacy-peer-deps
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
npm run dev
```

## Branch Protection Rules

The `main` branch is protected with the following rules:

- **Required status checks before merging:**
  - `Lint` — ESLint + Prettier checks must pass
  - `Type Check` — TypeScript strict mode compilation
  - `Test` — All unit and integration tests must pass
  - `Build` — Full production build must succeed
- **Require pull request reviews:** At least 1 approval required
- **Require branches to be up to date** before merging
- **No direct pushes** to `main`

## Development Workflow

1. Create a feature branch from `main`: `git checkout -b feat/your-feature`
2. Make your changes with clear, atomic commits
3. Run checks locally before pushing:
   ```bash
   npm run lint
   npm run typecheck
   npm run build
   ```
4. Open a PR against `main`
5. Wait for CI to pass and get a review
6. Squash and merge

## Branch Naming

- `feat/` — new features
- `fix/` — bug fixes
- `chore/` — tooling, deps, config
- `docs/` — documentation only

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(api): add user registration endpoint
fix(web): correct map marker positioning
chore: update dependencies
```

## Project Structure

```
EVBikeRental/
├── apps/
│   ├── api/          # Express + TypeScript backend
│   └── web/          # React + Vite + TypeScript frontend
├── packages/
│   └── shared/       # Shared types, enums, constants
├── .github/workflows/ci.yml
├── package.json      # Root workspace config
└── tsconfig.json     # Root TS project references
```

## Tech Stack Decisions

These are locked for MVP — don't change without team consensus:

| Area       | Choice                         | NOT this                    |
|------------|--------------------------------|-----------------------------|
| Database   | SQLite + better-sqlite3        | PostgreSQL                  |
| ORM        | Drizzle ORM                    | Prisma                      |
| Auth       | Email/password + JWT           | OAuth, external providers   |
| Maps       | Leaflet.js + OpenStreetMap     | Mapbox (requires API key)   |
| Payments   | Mock adapter                   | Stripe                      |
| Geo        | Haversine in app code          | PostGIS                     |
