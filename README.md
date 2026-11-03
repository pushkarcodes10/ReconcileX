# ReconcileX

ReconcileX is a multi-tenant financial transaction reconciliation platform designed to ingest, normalize, and match high-volume financial data across independent systems, including internal enterprise resource planning (ERP) records, payment gateways, and banking statements.

---

# Part 1: Product Guide for Non-Technical Users

This section provides an operational overview for finance managers, business analysts, operations teams, and compliance officers.

## 1. Executive Summary

Financial operations frequently require verifying that records from one system correspond accurately to records in another. For example, an organization must confirm that customer orders recorded in an internal database match settlement transactions from a payment processor (such as Stripe) and deposit records on a bank statement.

Manual reconciliation in spreadsheets is time-consuming, prone to human error, and difficult to audit. ReconcileX automates this process by:
- Ingesting transaction statements from disparate sources.
- Normalizing varied data formats into a standardized structure.
- Identifying exact matches and flagging potential matches based on configurable criteria.
- Isolating unmatched transactions into an exception queue for analyst investigation.
- Maintaining an immutable audit log of every action taken for compliance and audit readiness.

## 2. Key Business Capabilities

### Multi-Source Data Ingestion
Organizations can define external data sources (e.g., "Internal Ledger", "Stripe Gateway", "Chase Operating Account") and configure column mappings for CSV uploads. ReconcileX validates incoming records, flags invalid rows, and detects duplicate files or duplicate transactions.

### Automated Reconciliation Engine
ReconcileX pairs two data sources (Source A and Source B) over a selected date range and executes deterministic matching algorithms:
- **Exact Matches**: Transactions matching precisely on amount, date, reference identifier, or transaction code are matched and confirmed automatically.
- **Potential Matches**: Transactions with minor differences (such as slight date offsets or partial reference matches) are flagged with a confidence score for human review.
- **Unmatched Transactions**: Records present in one system but absent in the other are isolated for investigation.

### Exception Management Workflow
Unmatched transactions automatically enter an exception lifecycle:
1. **Open**: The discrepancy is recorded and visible in the queue.
2. **Assigned**: The exception is assigned to an analyst for investigation.
3. **Under Review**: Supporting notes and comments are added as the cause is researched.
4. **Escalated**: Complex discrepancies can be escalated to supervisors.
5. **Resolved**: The discrepancy is marked resolved once adjusted or cleared.
All status transitions and comments are tracked with user attribution and timestamps.

### Multi-Tenant Isolation and Role-Based Governance
Each organization operates in complete data isolation. Team access is managed using defined roles:
- **Owner**: Complete organizational control, billing, and membership administration.
- **Admin**: Configuration of data sources, organizational settings, and team management.
- **Analyst**: Data upload, reconciliation run execution, match review, and exception resolution.
- **Auditor**: Read-only access to transactions, reconciliation runs, exceptions, and audit logs.

### Audit Trail
Every critical operational event—including CSV uploads, reconciliation runs, match confirmations, manual rejections, and exception state transitions—is recorded in an append-only audit log containing the user identifier, timestamp, action, and affected entities.

## 3. Operational Workflow

```
[ Step 1: Data Source Setup ]
Map CSV headers from your systems (e.g., Date, Amount, Reference) to standard fields.
              │
              ▼
[ Step 2: Statement Upload ]
Upload CSV files. The system validates formatting and checks for duplicate files.
              │
              ▼
[ Step 3: Run Reconciliation ]
Select Source A and Source B, choose the date range, and execute the run.
              │
              ▼
[ Step 4: Review and Exceptions ]
Review exact matches, confirm or reject potential matches, and resolve exceptions.
              │
              ▼
[ Step 5: Audit & Reporting ]
Inspect audit trails and review completed reconciliation statistics.
```

---

# Part 2: Technical Architecture and Developer Guide

This section provides technical documentation for software engineers, DevOps personnel, and system administrators.

## 1. Technical Stack

- **Runtime**: Node.js (v20+ or v22+)
- **Package Manager**: pnpm (v12.x / v9.x workspaces)
- **Monorepo Architecture**: Modular monolith
- **Backend Framework**: NestJS 10 (TypeScript in strict mode)
- **Database**: PostgreSQL 16
- **ORM / Query Builder**: Drizzle ORM with Drizzle Kit migrations
- **Object Storage**: S3-compatible object storage (MinIO for local development, AWS S3 in production)
- **Frontend Framework**: React 18, Vite, React Router v6, TanStack Query, Tailwind CSS
- **Authentication**: JWT access tokens and rotating refresh tokens delivered via httpOnly, Secure, SameSite=Lax cookies; passwords hashed using Argon2id
- **Logging**: Pino structured JSON logging (`nestjs-pino`) with automatic redaction of sensitive credentials and headers
- **Testing**: Vitest with SWC for unit and integration testing; Testing Library for frontend components
- **API Documentation**: OpenAPI / Swagger (`/api/docs`)

## 2. Monorepo Structure

```
reconcile-x/
├── apps/
│   ├── api/                     # NestJS backend application
│   │   ├── src/
│   │   │   ├── common/          # Guards (OrgGuard, RolesGuard), filters, middleware
│   │   │   ├── config/          # Environment validation (class-validator) and schema
│   │   │   ├── database/        # Drizzle database module and connection pool
│   │   │   ├── health/          # Liveness and readiness endpoints
│   │   │   └── modules/         # Domain modules (auth, orgs, data-sources, transactions,
│   │   │                        # imports, reconciliation, exceptions, audit, jobs, dashboard)
│   │   └── test/                # API integration test suites
│   └── web/                     # React Single Page Application (SPA)
│       └── src/
│           ├── api/             # API client with credential handling and refresh mutex
│           ├── auth/            # Authentication context and permission definitions
│           ├── features/        # Feature views (dashboard, reconciliation, exceptions,
│           │                    # imports, data sources, audit, jobs, settings)
│           └── shared/          # Reusable UI components and utilities
├── packages/
│   ├── db/                      # Shared PostgreSQL schema definitions and Drizzle migrations
│   ├── matching/                # Pure TypeScript deterministic reconciliation matching engine
│   └── csv/                     # Streaming CSV parser, normalizer, and row validator
├── docs/                        # Architecture documentation, ADRs, and progress tracking
└── infra/
    └── docker/                  # Local infrastructure containers (PostgreSQL, MinIO)
```

## 3. Core Architectural Decisions

1. **Monetary Storage in Integer Minor Units (ADR 003)**:
   All monetary amounts are stored as `BIGINT` minor units (e.g., cents, paise) paired with an ISO-4217 three-letter currency code. Standard floating-point values are rejected to prevent IEEE 754 binary rounding inaccuracies during reconciliation.
2. **Two-Source Pairing Model (ADR 004)**:
   Each reconciliation run strictly pairs two data sources (Source A and Source B). Multi-party workflows are modeled as sequential two-way runs (e.g., Internal Orders vs. Payment Gateway, then Payment Gateway vs. Bank Statement).
3. **Tenant Scoping & IDOR Prevention**:
   Every database query is explicitly filtered by `organization_id`. The application returns HTTP 404 (Not Found) rather than 403 (Forbidden) when a user references a resource belonging to a different tenant, preventing cross-tenant existence enumeration.
4. **Persistent Job Tracking (ADR 005)**:
   Asynchronous workflows are tracked in a dedicated `jobs` table, maintaining an explicit state lifecycle (`QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`) with progress tracking and sanitized error reporting.
5. **Deduplication and Quarantine (ADR 006)**:
   Uploaded CSV files are fingerprinted via SHA-256 to reject duplicate file uploads immediately. Duplicate candidate transactions within a file or against existing records are quarantined in a `duplicate_candidates` table rather than silently discarded.

## 4. Local Development Setup

### Prerequisites

Ensure the following tools are installed:
- Node.js >= 20.10.0
- pnpm >= 9.0.0
- Docker and Docker Compose

### Step 1: Clone and Install Dependencies

```bash
git clone <repository-url>
cd reconcile-x
pnpm install
```

### Step 2: Environment Configuration

Copy the example environment file or configure `.env` in the project root:

```bash
# Application Environment
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1

# Security & CORS
CORS_ORIGIN=http://localhost:5173
CORS_CREDENTIALS=true

# Logging
LOG_LEVEL=info

# JWT Authentication (generate a secure random 32+ character string in production)
JWT_SECRET=your-secure-jwt-secret-minimum-32-chars-long
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# PostgreSQL Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=reconcilex
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/reconcilex

# MinIO / S3 Object Storage
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001
MINIO_USE_SSL=false
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
MINIO_BUCKET=reconcilex-imports
```

### Step 3: Start Local Infrastructure

Start PostgreSQL and MinIO using Docker Compose:

```bash
pnpm docker:up
```

Verify that the containers are healthy:

```bash
docker ps
```

### Step 4: Run Database Migrations

Apply existing schema migrations to your PostgreSQL instance:

```bash
pnpm db:migrate
```

To generate new migrations after updating schema definitions in `packages/db/src/schema`:

```bash
pnpm db:generate
```

### Step 5: Start the Development Servers

Start the backend API (port 3000):

```bash
pnpm dev:api
```

In a separate terminal, start the web frontend (port 5173):

```bash
pnpm dev:web
```

- API Base URL: `http://localhost:3000/api/v1`
- Swagger API Documentation: `http://localhost:3000/api/docs`
- Web Frontend: `http://localhost:5173`

## 5. Testing and Code Quality

Run tests across all workspaces:

```bash
# Execute all test suites (matching, csv, web, api)
pnpm test

# Run tests for a specific workspace
pnpm --filter @reconcilex/api test
pnpm --filter @reconcilex/web test
pnpm --filter @reconcilex/matching test
pnpm --filter @reconcilex/csv test

# Execute typechecking across all projects
pnpm typecheck

# Check formatting and linting
pnpm lint
pnpm format:check

# Format code
pnpm format
```

## 6. Build Instructions

Build all applications and packages for production:

```bash
pnpm build
```

This compiles:
- TypeScript libraries in `packages/db`, `packages/csv`, and `packages/matching` into `dist/`.
- The NestJS API into `apps/api/dist/`.
- The React application into `apps/web/dist/`.

## 7. Health and Probes

The backend exposes health endpoints:
- `GET /api/v1/health`: Liveness probe indicating process availability.
- `GET /api/v1/health/ready`: Readiness probe verifying PostgreSQL database connectivity and response latency. Returns HTTP 503 if dependencies are unreachable.
