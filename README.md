# ReconcileX — Financial Transaction Reconciliation Platform

ReconcileX is a production-grade, multi-tenant transaction reconciliation platform designed as a modular monolith. It enables organizations to ingest financial statements from disparate sources (such as internal ERP orders, payment gateways, and banking records), normalize data, flag duplicate records, run deterministic matching rules, and manage exception resolution workflows with an immutable audit trail.

---

## Architecture Overview

ReconcileX is structured as a scalable pnpm monorepo consisting of:

- **Apps**:
  - `apps/api`: NestJS application providing the HTTP API, global validation, request ID tracing, JWT authentication, and multi-tenant RBAC enforcement.
- **Packages**:
  - `packages/db`: Drizzle ORM schemas, database migrations, connection pooling, and shared database types.
- **Infrastructure**:
  - `infra/docker`: PostgreSQL 16 container definition via Docker Compose.

### Implemented Phases

- **Phase A1: Backend Foundation**:
  - pnpm monorepo structure with strict TypeScript.
  - Global `RequestIdMiddleware` attaching `X-Request-Id` to all requests and responses.
  - Pino structured logging with automatic credential redaction.
  - Global `GlobalExceptionFilter` with sanitized RFC-style error envelopes.
  - Health (`/api/v1/health`) and PostgreSQL readiness probe (`/api/v1/health/ready`).
  - Interactive Swagger / OpenAPI documentation at `/api/docs`.
- **Phase A2: Authentication, Organizations & RBAC**:
  - Argon2id password hashing with memory-hard parameters.
  - JWT access tokens (15m expiry) and rotating refresh tokens (7d expiry).
  - Secure `httpOnly`, `SameSite=Lax` cookies with Authorization Bearer header fallback.
  - Single-use cryptographically secure refresh token rotation and revocation.
  - Multi-tenant organization isolation (`organizations`, `organization_memberships`).
  - Four-tier Role-Based Access Control: `ADMIN`, `FINANCE_MANAGER`, `ANALYST`, `AUDITOR`.
  - Last-ADMIN protection preventing organizations from being orphaned.
  - Cross-tenant data isolation: unassociated requests return `404 Not Found` to prevent IDOR probing.
  - Secure token-based invitation and password reset lifecycles.
- **Phase A3: Data Sources & Transaction Catalog**:
  - Organization-scoped `data_sources` catalog with canonical CSV column mappings.
  - Safe deletion lifecycle: soft-deletion (`deleted_at`) for empty sources, blocking deletion with `409 Conflict` if transactions exist.
  - Organization-level unique name constraints on active (non-deleted) data sources via partial PostgreSQL indexes.
  - Database-enforced tenant isolation on `transactions` using composite foreign key constraint `(organization_id, data_source_id) REFERENCES data_sources(organization_id, id)`.
  - Integer minor currency amounts (`BIGINT amount_minor`) avoiding floating-point rounding errors.
  - Transaction read APIs supporting filtering (`sourceId`, `dateFrom`, `dateTo`, `amount`, `status`, `q`), multi-column sorting, and cursor-based & offset pagination.
  - Empty table behavior returning HTTP 200 with empty array and valid pagination metadata.
  - Role protection: Creation/Update/Deletion restricted to `ADMIN` and `FINANCE_MANAGER`; Read operations available to all organization roles.

---

## Directory Structure

```text
reconcile-x/
├── apps/
│   └── api/
│       ├── src/
│       │   ├── common/
│       │   │   ├── decorators/        # @CurrentUser, @CurrentOrg, @Roles
│       │   │   ├── filters/           # Global exception filter
│       │   │   ├── guards/            # JwtAuthGuard, OrgGuard, RolesGuard
│       │   │   ├── interceptors/      # Response interceptors
│       │   │   └── middleware/        # Request ID tracking
│       │   ├── config/                # Environment validation & typed config
│       │   ├── database/              # DB connection provider & lifecycle
│       │   ├── health/                # Health & readiness probes
│       │   ├── modules/
│       │   │   ├── auth/              # Authentication, tokens, password hashing
│       │   │   ├── data-sources/      # Data source CRUD, column mappings, soft delete
│       │   │   ├── organizations/     # Multi-tenancy, memberships, invitations
│       │   │   └── transactions/      # Transaction catalog & paginated read APIs
│       │   ├── app.module.ts          # Main application module
│       │   └── main.ts                # Bootstrap, cookie parser & Swagger
│       ├── test/                      # Vitest test suite (51 unit & integration tests)
│       ├── package.json
│       ├── tsconfig.json
│       └── vitest.config.ts
├── packages/
│   └── db/
│       ├── drizzle/                   # Drizzle migration files (.sql)
│       ├── src/
│       │   ├── schema/                # Users, orgs, memberships, data-sources, transactions
│       │   └── index.ts               # Database client & exports
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

Before starting, ensure the following are installed:

- **Node.js**: `v20.x` or `v22.x`+ (LTS recommended)
- **pnpm**: `v9.x` or `v12.x`+ (`npm install -g pnpm`)
- **Docker & Docker Compose**: For containerized PostgreSQL 16 (or an existing PostgreSQL 16 instance)
- **PowerShell** (Windows) or **Bash** (macOS/Linux)

---

## Quickstart Guide

### 1. Install Dependencies

```powershell
pnpm install
```

### 2. Configure Environment Variables

Create `.env` by copying `.env.example`:

```powershell
Copy-Item .env.example .env
```

Key environment variables:

| Variable                   | Default Value                                              | Description                          |
| -------------------------- | ---------------------------------------------------------- | ------------------------------------ |
| `NODE_ENV`                 | `development`                                              | Runtime environment                  |
| `PORT`                     | `3000`                                                     | HTTP port for NestJS API             |
| `API_PREFIX`               | `api/v1`                                                   | Route prefix                         |
| `JWT_SECRET`               | `reconcilex-super-secret-jwt-key...`                       | Minimum 32-character HMAC secret key |
| `JWT_EXPIRES_IN`           | `15m`                                                      | Short-lived access token lifespan    |
| `REFRESH_TOKEN_EXPIRES_IN` | `7d`                                                       | Rotating refresh token lifespan      |
| `POSTGRES_HOST`            | `localhost`                                                | PostgreSQL host                      |
| `POSTGRES_PORT`            | `5432`                                                     | PostgreSQL port                      |
| `DATABASE_URL`             | `postgresql://postgres:postgres@localhost:5432/reconcilex` | Database connection string           |

---

### 3. Database Migration & Schema Setup

Start the containerized PostgreSQL database:

```powershell
pnpm run docker:up
```

Generate database migrations (if modifying schemas):

```powershell
pnpm run db:generate
```

Apply database migrations:

```powershell
pnpm run db:migrate
```

---

### 4. Build & Start the Application

Build all workspaces:

```powershell
pnpm run build
```

Start the API with hot reloading:

```powershell
pnpm run dev
```

Interactive Swagger documentation is available at:
`http://localhost:3000/api/docs`

---

## Testing & Quality Verification

Run all test suites and code linters from the root directory:

```powershell
# Run all Vitest unit and integration tests (51 tests across 8 suites)
pnpm test

# Run TypeScript typechecking across all workspace packages
pnpm run typecheck

# Run ESLint
pnpm run lint

# Verify Prettier code style
pnpm run format:check
```

---

## Data Sources & Transactions API Guide (Phase A3)

### Canonical Column Mapping Structure

Each data source defines a `column_mapping` JSON object mapping raw CSV header names to canonical transaction fields:

```json
{
  "external_id": "Order ID",
  "amount": "Transaction Amount",
  "date": "Payment Date",
  "currency": "Currency",
  "reference": "Customer Reference",
  "external_txn_id": "Gateway Transaction ID",
  "merchant_or_order_id": "Merchant Order ID",
  "txn_type": "Transaction Type"
}
```

- **Required Fields**: `external_id`, `amount`, `date`, `currency`
- **Optional Fields**: `reference`, `external_txn_id`, `merchant_or_order_id`, `txn_type`

---

### End-to-End Example: Creating Two Data Sources in an Organization

After logging in as an `ADMIN` or `FINANCE_MANAGER`:

#### 1. Create Internal Orders Source (`INTERNAL_ORDERS`)

```powershell
$ordersSource = @{
  name = "Shopify Store Orders"
  type = "INTERNAL_ORDERS"
  columnMapping = @{
    external_id = "Order ID"
    amount = "Gross Amount"
    date = "Order Date"
    currency = "Currency"
    reference = "Customer Ref"
  }
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/v1/orgs/$orgId/data-sources" `
  -Method Post `
  -ContentType "application/json" `
  -Body $ordersSource `
  -WebSession $session
```

**Response (201 Created):**

```json
{
  "id": "7f09f2d0-3bc8-43d9-93e1-a987d6e49221",
  "organizationId": "d3b07384-d113-4638-b7c1-0c5a2982d1a3",
  "name": "Shopify Store Orders",
  "type": "INTERNAL_ORDERS",
  "direction": "INCOMING",
  "columnMapping": {
    "external_id": "Order ID",
    "amount": "Gross Amount",
    "date": "Order Date",
    "currency": "Currency",
    "reference": "Customer Ref"
  },
  "status": "ACTIVE",
  "createdAt": "2026-10-31T15:00:00.000Z",
  "updatedAt": "2026-10-31T15:00:00.000Z",
  "deletedAt": null
}
```

#### 2. Create Payment Gateway Source (`PAYMENT_GATEWAY`)

```powershell
$gatewaySource = @{
  name = "Stripe Payments"
  type = "PAYMENT_GATEWAY"
  columnMapping = @{
    external_id = "Charge ID"
    amount = "Amount Charged"
    date = "Created (UTC)"
    currency = "Currency Code"
    reference = "Metadata Invoice Ref"
    external_txn_id = "Balance Transaction ID"
  }
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/v1/orgs/$orgId/data-sources" `
  -Method Post `
  -ContentType "application/json" `
  -Body $gatewaySource `
  -WebSession $session
```

---

### Querying Data Sources

#### List Data Sources with Filtering & Pagination:

```powershell
# Filter by type and status with pagination
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/orgs/$orgId/data-sources?type=PAYMENT_GATEWAY&status=ACTIVE&page=1&limit=10" `
  -Method Get `
  -WebSession $session
```

#### Get Specific Data Source:

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/orgs/$orgId/data-sources/$sourceId" `
  -Method Get `
  -WebSession $session
```

#### Safe Deletion:

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/orgs/$orgId/data-sources/$sourceId" `
  -Method Delete `
  -WebSession $session
```

- If no transactions exist: Soft-deletes the source (`deleted_at = NOW()`, `status = INACTIVE`).
- If transactions exist: Returns `409 Conflict` blocking physical deletion and preventing orphan transactions.

---

### Querying Transactions

Transactions are scoped strictly by `organization_id`. CSV ingestion and row import workflow will be implemented in **Phase A4**.

#### Query Transactions with Filters:

```powershell
# Query transactions with date range, minimum amount, and search query
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/orgs/$orgId/transactions?dateFrom=2026-01-01T00:00:00.000Z&dateTo=2026-01-31T23:59:59.999Z&minAmount=5000&status=UNMATCHED&q=INV-100&page=1&limit=20" `
  -Method Get `
  -WebSession $session
```

**Response Format (200 OK):**

```json
{
  "data": [],
  "total": 0,
  "page": 1,
  "limit": 20,
  "totalPages": 0,
  "nextCursor": null,
  "hasMore": false
}
```

#### Query Single Transaction Details:

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/orgs/$orgId/transactions/$transactionId" `
  -Method Get `
  -WebSession $session
```

Returns single transaction details including `normalizedPayload` and deduplication `fingerprint`.

---

## Current Scope & Limitations (Phase A3)

- **Transaction Ingestion**: Transactions schema and read APIs are fully implemented. Writing imported transactions via CSV uploads, MinIO S3 object storage, row validation, and duplicate candidate quarantine will be delivered in **Phase A4**.
- **Reconciliation Matching**: Matching algorithms (`packages/matching`) and reconciliation run execution will follow in **Phase A5** and **Phase A6**.
