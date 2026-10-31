# ReconcileX — Financial Transaction Reconciliation Platform

ReconcileX is a production-grade, multi-tenant transaction reconciliation platform designed as a modular monolith. It enables organizations to ingest financial statements from disparate sources (such as internal ERP orders, payment gateways, and banking records), normalize data, flag duplicate records, run deterministic matching rules, and manage exception resolution workflows with an immutable audit trail.

---

## Architecture Overview (Phase A1: Backend Foundation)

In this foundational phase, ReconcileX provides:

- **pnpm Monorepo**: Separates API applications (`apps/api`) and shared database packages (`packages/db`).
- **NestJS Modular Core**: Bootstrapped with strict TypeScript, global validation, and graceful shutdown hooks.
- **Drizzle ORM Connection Layer**: Lightweight, high-performance PostgreSQL connection pool ready for upcoming schema phases.
- **Pino Structured Logging**: Request/response lifecycle tracking with automatic redaction of sensitive credentials.
- **Request ID Tracking**: Correlation across incoming requests, structured logs, and error responses via `X-Request-Id`.
- **Global Error Handling**: Standardized error envelopes that prevent data leaks and hide internal stack traces.
- **Health & Readiness Endpoints**: Liveness probe (`/api/v1/health`) and live PostgreSQL readiness probe (`/api/v1/health/ready`).
- **OpenAPI / Swagger**: Interactive API documentation available at `/api/docs`.
- **Vitest Suite**: Fast unit and integration tests covering bootstrap, health, request ID propagation, and exception handling.

---

## Directory Structure

```text
reconcile-x/
├── apps/
│   └── api/
│       ├── src/
│       │   ├── common/
│       │   │   ├── filters/           # Global exception filter
│       │   │   ├── interceptors/      # Response interceptors
│       │   │   └── middleware/        # Request ID tracking
│       │   ├── config/                # Environment validation & typed config
│       │   ├── database/              # DB connection provider & lifecycle
│       │   ├── health/                # Health & readiness probes
│       │   ├── app.module.ts          # Main application module
│       │   └── main.ts                # Bootstrap & Swagger setup
│       ├── test/                      # Vitest test suite
│       ├── package.json
│       ├── tsconfig.json
│       └── vitest.config.ts
├── packages/
│   └── db/
│       ├── src/
│       │   ├── schema/                # Drizzle schema definitions
│       │   └── index.ts               # Database client & health check
│       ├── drizzle.config.ts
│       ├── package.json
│       └── tsconfig.json
├── infra/
│   └── docker/
│       └── docker-compose.yml         # PostgreSQL 16 local container
├── docs/
│   ├── adr/                           # Architecture Decision Records
│   └── architecture.md
├── .env.example
├── .gitignore
├── .prettierrc
├── eslint.config.mjs
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

---

## Prerequisites

Before starting, ensure the following are installed on your host machine:

- **Node.js**: `v20.x` or `v22.x`+ (LTS recommended)
- **pnpm**: `v9.x` or `v12.x`+ (`npm install -g pnpm`)
- **Docker & Docker Compose**: For containerized PostgreSQL 16 (or an existing PostgreSQL instance)
- **PowerShell** (Windows) or **Bash** (macOS/Linux)

---

## Quickstart Guide (Windows PowerShell)

### 1. Clone & Install Dependencies

From the project root:

```powershell
# Install all workspace dependencies
pnpm install
```

### 2. Configure Environment Variables

Create your local `.env` file by copying the example:

```powershell
Copy-Item .env.example .env
```

Default configuration in `.env`:

| Variable            | Default Value                                              | Description                                                   |
| ------------------- | ---------------------------------------------------------- | ------------------------------------------------------------- |
| `NODE_ENV`          | `development`                                              | Runtime environment                                           |
| `PORT`              | `3000`                                                     | HTTP port for the NestJS API                                  |
| `API_PREFIX`        | `api/v1`                                                   | Global API route prefix                                       |
| `CORS_ORIGIN`       | `http://localhost:5173`                                    | Allowed CORS origins (comma-separated or `*`)                 |
| `CORS_CREDENTIALS`  | `true`                                                     | Allow credentials in CORS requests                            |
| `LOG_LEVEL`         | `info`                                                     | Logging verbosity (`fatal`, `error`, `warn`, `info`, `debug`) |
| `POSTGRES_HOST`     | `localhost`                                                | PostgreSQL host                                               |
| `POSTGRES_PORT`     | `5432`                                                     | PostgreSQL port                                               |
| `POSTGRES_USER`     | `postgres`                                                 | Database username                                             |
| `POSTGRES_PASSWORD` | `postgres`                                                 | Database password                                             |
| `POSTGRES_DB`       | `reconcilex`                                               | Database name                                                 |
| `DATABASE_URL`      | `postgresql://postgres:postgres@localhost:5432/reconcilex` | Complete connection string                                    |

---

### 3. Start PostgreSQL via Docker Compose

Start the PostgreSQL 16 container:

```powershell
# Start PostgreSQL in the background
pnpm run docker:up

# Check container status
docker ps
```

To stop the container:

```powershell
pnpm run docker:down
```

---

### 4. Build and Start the API

#### Build all packages:

```powershell
pnpm run build
```

#### Run in development mode (with hot reloading):

```powershell
pnpm run dev
```

#### Run in production mode:

```powershell
node apps/api/dist/main.js
```

---

## Health Check and API Verification

Once the API is running, verify the endpoints:

### Liveness Probe

- **URL**: `http://localhost:3000/api/v1/health`
- **Method**: `GET`
- **Expected Status**: `200 OK`
- **Response**:

```json
{
  "status": "ok",
  "timestamp": "2026-10-31T08:00:00.000Z",
  "uptime": 12.34
}
```

### Readiness Probe (PostgreSQL connectivity check)

- **URL**: `http://localhost:3000/api/v1/health/ready`
- **Method**: `GET`
- **Expected Status**: `200 OK` (when database is reachable) / `503 Service Unavailable` (when unreachable)
- **Healthy Response (200)**:

```json
{
  "status": "ok",
  "timestamp": "2026-10-31T08:00:00.000Z",
  "checks": {
    "database": {
      "status": "up",
      "latencyMs": 3
    }
  }
}
```

- **Unhealthy Response (503)**:

```json
{
  "status": "error",
  "timestamp": "2026-10-31T08:00:00.000Z",
  "checks": {
    "database": {
      "status": "down"
    }
  }
}
```

### Swagger Documentation

- **URL**: `http://localhost:3000/api/docs`
- Interactive OpenAPI 3.0 explorer with schemas, tags, and request ID parameters.

---

## Running Quality Checks and Tests

Run the full verification suite using the root scripts:

```powershell
# Run Vitest test suite
pnpm test

# Run TypeScript typechecking across all workspaces
pnpm run typecheck

# Run ESLint across all files
pnpm run lint

# Check Prettier code formatting
pnpm run format:check

# Auto-format files
pnpm run format
```

---

## Troubleshooting

### 1. Database Readiness Check Returns 503

- Ensure the PostgreSQL container is running: `docker ps`
- Verify that credentials in `.env` match Docker Compose (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`).
- If using an existing local PostgreSQL service, update `.env` with your local port and password.

### 2. Port Conflict on 3000 or 5432

- If port `3000` is already in use by another application, change `PORT=3001` in `.env`.
- If port `5432` is in use, modify `POSTGRES_PORT=5433` in `.env`. Docker Compose will map host port `5433` to container port `5432`.

### 3. pnpm Execution Policy (Windows PowerShell)

- If PowerShell blocks scripts (`pnpm : File ... cannot be loaded because running scripts is disabled`), run:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```
