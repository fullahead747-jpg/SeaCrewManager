# SeaCrewManager (CrewTrack Pro) - Project Documentation

## 1. Project Overview
SeaCrewManager (branded as **CrewTrack Pro**) is a comprehensive maritime crew management system. It allows for the management of vessels, crew members, contracts, documents, and rotations.

**Key Features:**
-   **Fleet Dashboard**: Overview of vessels and crew statistics.
-   **Crew Management**: Detailed profiles, document tracking, and certifications.
-   **Contract Management**: Active contracts, salary tracking, and expiration alerts.
-   **Document Processing**: OCR capabilities for crew documents.
-   **System Logs**: Activity logging for audit trails.

## 2. Technology Stack

### Frontend
-   **Framework**: [React](https://react.dev/) (v18)
-   **Build Tool**: [Vite](https://vitejs.dev/)
-   **Language**: TypeScript
-   **Styling**: [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) components.
-   **State/Data Fetching**: [TanStack Query](https://tanstack.com/query) (React Query).
-   **Routing**: [wouter](https://github.com/molefrog/wouter) (Minimalist router).

### Backend
-   **Runtime**: Node.js
-   **Framework**: [Express.js](https://expressjs.com/)
-   **Language**: TypeScript (`tsx` for execution).
-   **Database ORM**: [Drizzle ORM](https://orm.drizzle.team/).
-   **Database**: PostgreSQL (Hosted on Neon.tech for this instance).
-   **Validation**: [Zod](https://zod.dev/).

## 3. Project Structure

The project follows a standard monorepo-like structure with separate `client` and `server` directories but shared types.

```
/
├── client/                 # Frontend React Application
│   ├── src/
│   │   ├── components/     # Reusable UI components (shadcn/ui)
│   │   ├── pages/          # Full page views (Dashboard, CrewList, etc.)
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utilities (api.ts, utils.ts)
│   │   ├── App.tsx         # Main application component & routing
│   │   └── main.tsx        # Entry point
│   └── index.html
├── server/                 # Backend Node.js Application
│   ├── services/           # Business logic (Notification, Background jobs)
│   ├── db.ts               # Database connection configuration
│   ├── index.ts            # Server entry point (Setup Express & HTTP)
│   ├── routes.ts           # API Route Route definitions
│   ├── storage.ts          # Data access layer (CRUD operations)
│   └── vite.ts             # Vite middleware for dev mode
├── shared/                 # Shared Code
│   └── schema.ts           # Database schema & Types (Drizzle/Zod)
├── uploads/                # Local storage for uploaded files
├── dist/                   # Production build artifacts
└── .env                    # Environment variables
```

## 4. Setup & Installation

### Prerequisites
-   Node.js (v18+)
-   PostgreSQL Database (Connection string required)

### Step-by-Step Guide
1.  **Clone/Download** the repository.
2.  **Install Dependencies**:
    ```bash
    npm install
    ```
3.  **Environment Configuration**:
    Create a `.env` file in the root directory:
    ```env
    DATABASE_URL=postgresql://user:pass@host:port/dbname?sslmode=require
    PORT=5000
    NODE_ENV=development
    ```
4.  **Database Setup**:
    Push the schema to your database:
    ```bash
    npm run db:push
    ```
5.  **Run Development Server**:
    **Windows**:
    ```bash
    npm run dev
    # If using Windows CMD, usage of cross-env recommended:
    # npx cross-env NODE_ENV=development DATABASE_URL=... tsx server/index.ts
    ```
    **Linux/Mac/Replit**:
    ```bash
    npm run dev
    ```

## 5. Database Schema (`shared/schema.ts`)

The application uses **PostgreSQL**. The schema is defined using Drizzle ORM.

**Key Tables:**
-   `users`: Authentication and roles (Admin/Office Staff).
-   `vessels`: Fleet information.
-   `crew_members`: Core crew data (Personal, Rank, Status).
-   `documents`: Crew documents (Passport, STCW, etc.) with expiry dates.
-   `contracts`: Employment contracts linking Crew to Vessels.
-   `activity_logs`: Audit trail for all system actions.

## 6. API Documentation (`server/routes.ts`)

### Authentication
-   `POST /api/auth/login`: Basic login (updates session/logs).

### Vessels
-   `GET /api/vessels`: List all vessels with crew stats.
-   `POST /api/vessels`: Create a new vessel.
-   `PUT /api/vessels/:id`: Update vessel details.

### Crew
-   `GET /api/crew`: List crew members (optional `?vesselId=` filter).
-   `POST /api/crew`: Add new crew member.
-   `PUT /api/crew/:id`: Update crew member (handles logic for vessel changes/rotations).
-   `DELETE /api/crew/:id`: Remove crew member (soft or hard delete depending on implementation).

### Documents
-   `GET /api/documents`: Fetch documents.
-   `POST /api/documents`: Upload/Create document metadata.
-   `PUT /api/documents/:id`: Update document (e.g., renewal).

## 7. Key Features for Developers

-   **Data Access**: All database interactions are abstracted in `server/storage.ts`. **Do not write direct SQL queries in routes**; add a method to `storage.ts`.
-   **Type Safety**: The project relies heavily on `zod` schemas exported from `shared/schema.ts`. Use them to validate API requests.
-   **Logging**: Use the `activityLogs` table for significant actions (Create/Update/Delete).
-   **OCR**: The app includes services (`groqOcrService.ts`, `localOcrService.ts`) for processing document uploads.

## 8. Deployment Notes (Replit)

This project is optimized for Replit:
1.  **Database**: Uses Neon serverless Postgres (via Replit Secrets).
2.  **Port**: Defaults to 5000 (standard for Replit webview).
3.  **Build**: `npm run build` creates the client bundle in `dist/`.

## 9. Replit Compatibility Guidelines (STRICT)

To ensure this project remains fully compatible with Replit's environment, all developers must adhere to the following rules:

1.  **Database**: ALWAYS use **PostgreSQL**.
    -   Do not introduce SQLite or local-only databases.
    -   Use `DATABASE_URL` from Replit Secrets (or Neon/Supabase).
    -   Tests must run against a real Postgres instance or mocked service, not SQLite.

2.  **server Configuration**:
    -   **Port**: Always default to port `5000` (`process.env.PORT || 5000`).
    -   **Binding**: Bind to host `0.0.0.0`.
    -   **Windows vs Linux**: Avoid `reusePort: true` in `server.listen` unless guarded by OS checks. It causes `ENOTSUP` on Windows but is fine on Linux.
    -   **File Paths**: Use `path.join(process.cwd(), ...)` for all file system access. Do not hardcode absolute paths like `C:\` or `/home/runner`.

3.  **Dependencies**:
    -   Do not rely on system-level binaries (like global `ffmpeg` or `imagemagick`) unless they are available in the Replit Nix environment (replit.nix).
    -   Stick to Node.js LTS versions defined in `package.json`.

4.  **Environment Variables**:
    -   Never commit `.env` files.
    -   Always use `process.env.VARIABLE_NAME`.

