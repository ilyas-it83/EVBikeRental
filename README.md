# ⚡ EV Bike Rental

A web platform for renting electric bikes. Find nearby stations, unlock a bike, ride, and return it — all from your browser.

## Quick Start

```bash
# Prerequisites: Node.js >= 20
git clone https://github.com/ilyas-it83/EVBikeRental.git
cd EVBikeRental

# Install all dependencies
npm install --legacy-peer-deps

# Copy environment files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Start both frontend and backend in dev mode
npm run dev
```

- **Frontend:** http://localhost:5173
- **API:** http://localhost:3001
- **Health check:** http://localhost:3001/api/health

## Scripts

| Command              | Description                                  |
|----------------------|----------------------------------------------|
| `npm run dev`        | Start web + API concurrently in dev mode     |
| `npm run build`      | Build all packages and apps for production   |
| `npm run lint`       | Run ESLint across the entire monorepo        |
| `npm run lint:fix`   | Auto-fix lint issues                         |
| `npm run typecheck`  | TypeScript strict-mode type checking         |
| `npm run format`     | Format code with Prettier                    |

## Project Structure

```
├── apps/
│   ├── api/             # Node.js + Express + TypeScript backend
│   │   └── src/
│   │       ├── routes/      # API route handlers
│   │       ├── services/    # Business logic
│   │       ├── middleware/  # Auth, validation, error handling
│   │       └── data/        # Drizzle ORM schemas, DB config
│   └── web/             # React 18 + Vite + TypeScript + Tailwind frontend
│       └── src/
├── packages/
│   └── shared/          # Shared types, enums, constants
└── .github/workflows/   # CI/CD pipelines
```

## Tech Stack

| Layer     | Technology                              |
|-----------|-----------------------------------------|
| Frontend  | React 18, Vite, TypeScript, Tailwind CSS |
| Backend   | Node.js, Express 5, TypeScript          |
| Database  | SQLite via better-sqlite3               |
| ORM       | Drizzle ORM                             |
| Auth      | JWT (httpOnly cookies) + bcrypt         |
| Maps      | Leaflet.js + OpenStreetMap              |
| Monorepo  | npm workspaces                          |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development workflow, branch rules, and conventions.
