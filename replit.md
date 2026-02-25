# SeaCrewManager (CrewTrack Pro)

## Overview

SeaCrewManager is a comprehensive maritime crew management system for managing vessels, crew members, contracts, documents, and rotations. Key capabilities include fleet dashboards, crew profiles with document tracking, contract and salary management, AI-powered OCR for document processing (passports, CDC, COC, medical certificates), expiry notifications, and an AI chatbot assistant for crew queries. The application also integrates WhatsApp notifications via WAHA.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite (output to `dist/public`)
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style)
- **State Management**: TanStack Query (React Query) for server state and data fetching
- **Routing**: wouter (lightweight client-side router)
- **Path Aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`
- **Component Config**: shadcn/ui configured in `components.json`, components live in `client/src/components/ui/`

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript, executed via `tsx` in development (`tsx watch server/index.ts`)
- **Entry Point**: `server/index.ts` sets up Express and HTTP server
- **API Routes**: Defined in `server/routes.ts`
- **Services**: Business logic in `server/services/` (notifications, background jobs, WhatsApp integration)
- **OCR Service**: `server/localOcrService.ts` handles document OCR with multi-engine support

### Database
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema**: Defined in `shared/schema.ts` — shared between frontend and backend
- **Connection**: Configured in `server/db.ts`, requires `DATABASE_URL` environment variable
- **Migrations**: Output to `./migrations` directory, managed via `drizzle-kit push` (`npm run db:push`)
- **Key Tables**: `vessels`, `crew_members`, `documents`, `contracts`, `scanned_documents`
- **Validation**: Zod schemas (likely generated from or alongside Drizzle schema)

### Build & Deploy
- **Dev**: `npm run dev` — runs `tsx watch server/index.ts` which serves both API and Vite dev frontend
- **Build**: `npm run build` — Vite builds frontend, esbuild bundles server to `dist/index.js`
- **Production**: `npm start` — runs `NODE_ENV=production node dist/index.js`
- **Docker**: Dockerfile configured for port 7860 (Hugging Face Spaces deployment)
- **Capacitor**: Mobile app wrapper configured (`capacitor.config.ts`) for Android voice assistant features

### Project Structure
```
client/               # React frontend
  src/
    components/       # UI components (shadcn/ui based)
    pages/            # Page views (Dashboard, CrewList, etc.)
    hooks/            # Custom React hooks
    lib/              # Utilities (api.ts, utils.ts)
    App.tsx           # Main app with routing
    main.tsx          # Entry point
server/               # Express backend
  index.ts            # Server entry point
  routes.ts           # API route definitions
  db.ts               # Database connection
  services/           # Business logic services
  localOcrService.ts  # OCR processing
shared/               # Shared code
  schema.ts           # Drizzle ORM schema + Zod types
migrations/           # Drizzle database migrations
dist/                 # Production build output
  public/             # Built frontend assets
  index.js            # Bundled server
```

## External Dependencies

### Database
- **PostgreSQL** — required, connected via `DATABASE_URL` environment variable
- **Drizzle ORM** — schema management and query building
- Previously hosted on Neon.tech; any PostgreSQL provider works

### AI & OCR Services
- **Google Gemini** (`@google/generative-ai`) — AI-powered OCR engine for document processing (requires `GEMINI_API_KEY`)

### Messaging & Notifications
- **WAHA (WhatsApp HTTP API)** — WhatsApp integration via Docker container, configured in `docker-compose.yml`
- **Email notifications** — for expiring documents and crew reports

### Cloud Storage
- **Google Cloud Storage** (`@google-cloud/storage`) — for persistent document file storage
- **Replit Object Storage** — alternative for Replit deployments (`PRIVATE_OBJECT_DIR` env var)

### Key Environment Variables
| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (required) |
| `GEMINI_API_KEY` | Google Gemini AI for OCR and document processing |
| `PRIVATE_OBJECT_DIR` | Replit object storage bucket path |
| `NODE_ENV` | Environment mode (production/development) |

### Deployment Targets
- **Replit** — primary development and hosting platform (with Replit-specific Vite plugins)
- **Hugging Face Spaces** — Docker-based deployment on port 7860
- **Hostinger** — traditional Node.js hosting option
- **Railway.app** — for WAHA WhatsApp service deployment