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
- **Phase A4: CSV Ingestion, MinIO & Duplicate Detection**:
  - Docker Compose service for MinIO S3-compatible object storage with auto-initialized persistent buckets and web console (`http://localhost:9001`).
  - Standalone `packages/csv` streaming CSV parser with UTF-8 BOM handling, whitespace stripping, and row-by-row incremental processing.
  - Currency-aware integer minor unit money conversion (e.g. `₹1,000.00` INR → `100000`, `$250.50` USD → `25050`, `¥1,000` JPY → `1000`) without floating-point math.
  - Strict date normalization supporting `YYYY-MM-DD`, `DD-MM-YYYY`, `DD/MM/YYYY`, and ISO 8601 into canonical `YYYY-MM-DD`.
  - Deterministic 64-character SHA-256 transaction fingerprints across canonical attributes.
  - Row-level validation error collection (`import_row_errors`) allowing partial imports without halting valid records.
  - File-level idempotency via content SHA-256 hash deduplication.
  - Duplicate quarantining (`duplicate_candidates`) with `FLAGGED` status for within-file and existing database duplicates.
  - `JobService` abstraction with synchronous in-process batch insertion (1,000 rows/batch) capped at 20,000 rows.
- **Phase A5: Deterministic Matching Engine (`packages/matching`)**:
  - Pure TypeScript domain package with zero framework, database, or HTTP dependencies.
  - **Rule 1 (Currency Strictness)**: Requires identical ISO currency codes; currency mismatch yields an immediate 0 score (`NONE`).
  - **Rule 2 (Exact Reference & Amount)**: Exact normalized reference + exact integer amount minor yields score 100 (`EXACT`).
  - **Rule 3 (Multi-Attribute Scoring)**:
    - Amount match: +30 points.
    - Date proximity: +20 points (0 days = 20, with configurable linear taper within date window).
    - Reference similarity: +50 points (exact normalized), +30 points (contains/substring).
    - Cross-reference identifier: +20 points (e.g. Order ID matched against Payment Gateway reference or transaction ID).
  - **Confidence Tiers**: `EXACT` (≥100), `POTENTIAL_STRONG` (≥80), `POTENTIAL` (≥60), `NONE` (<60).
  - **Explainable Reason Codes**: Detailed reason arrays and metadata payloads for auditability and UI explanations.
  - **Greedy Pairwise Engine (`matchTwoSets`)**:
    - Pairwise matching between Source A and Source B.
    - Enforces 1:1 cardinality (each transaction matches at most once per reconciliation run).
    - Highest-confidence pairs assigned first with deterministic tie-breaking.
    - Comprehensive statistics reporting (`matchedExactCount`, `matchedPotentialStrongCount`, `matchedPotentialCount`, `unmatchedACount`, `unmatchedBCount`).

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
│       │   │   ├── imports/           # CSV ingestion, batching, idempotency, duplicate quarantine
│       │   │   ├── organizations/     # Multi-tenancy, memberships, invitations
│       │   │   ├── storage/           # S3/MinIO & in-memory object storage adapters
│       │   │   └── transactions/      # Transaction catalog & paginated read APIs
│       │   ├── app.module.ts          # Main application module
│       │   └── main.ts                # Bootstrap, cookie parser & Swagger
│       ├── test/                      # Vitest test suite (62 unit & integration tests across 9 suites)
│       ├── package.json
│       ├── tsconfig.json
│       └── vitest.config.ts
├── packages/
│   ├── csv/                           # Standalone streaming CSV parser, validation & money normalizer (21 unit tests)
│   │   ├── src/                       # amount, currency, date, fingerprint, headers, stream
│   │   ├── test/                      # Vitest unit test suite
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── db/
│   │   ├── drizzle/                   # Drizzle migration files (.sql)
│   │   ├── src/
│   │   │   ├── schema/                # Users, orgs, memberships, data-sources, transactions, imports
│   │   │   └── index.ts               # Database client & exports
│   │   ├── drizzle.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── matching/                      # Pure deterministic matching engine & confidence scoring (13 unit tests)
│       ├── src/                       # scoring, engine, types
│       ├── test/                      # Vitest unit test suite
│       ├── package.json
│       └── tsconfig.json
├── infra/
│   └── docker/
│       └── docker-compose.yml         # PostgreSQL 16 & MinIO S3 object storage local containers
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
| `MINIO_ENDPOINT`           | `localhost`                                                | MinIO S3 API host                    |
| `MINIO_PORT`               | `9000`                                                     | MinIO S3 API port                    |
| `MINIO_CONSOLE_PORT`       | `9001`                                                     | MinIO Web Console port               |
| `MINIO_ROOT_USER`          | `minioadmin`                                               | MinIO root user                      |
| `MINIO_ROOT_PASSWORD`      | `minioadmin`                                               | MinIO root password                  |
| `MINIO_BUCKET`             | `reconcilex-imports`                                       | Default object storage bucket        |

---

### 3. Database & MinIO Storage Setup

Start the containerized PostgreSQL database and MinIO object storage:

```powershell
pnpm run docker:up
```

Access the MinIO Web Console at:
`http://localhost:9001` (User: `minioadmin`, Password: `minioadmin`)

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
# Run all Vitest unit and integration tests (120 tests across 14 suites)
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

## CSV Ingestion & Duplicate Quarantine Guide (Phase A4)

### 1. Upload CSV for Ingestion

Upload a transaction statement CSV file to a configured data source.

```powershell
$filePath = "transactions.csv"
$form = @{
  file = Get-Item -Path $filePath
}

$uploadRes = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/orgs/$orgId/data-sources/$sourceId/imports" `
  -Method Post `
  -Form $form `
  -WebSession $session
```

**Response (202 Accepted):**

```json
{
  "jobId": "e1438992-8051-4f01-a757-5b23d915998a",
  "importId": "e1438992-8051-4f01-a757-5b23d915998a",
  "status": "COMPLETED",
  "duplicateFile": false
}
```

_Note: If an identical file (matching content SHA-256) is uploaded to the same data source, ReconcileX returns the existing import record with `"duplicateFile": true` without creating redundant records._

---

### 2. Check Import Status and Counters

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/orgs/$orgId/imports/$importId/status" `
  -Method Get `
  -WebSession $session
```

**Response (200 OK):**

```json
{
  "id": "e1438992-8051-4f01-a757-5b23d915998a",
  "status": "COMPLETED",
  "rowCount": 2,
  "validCount": 2,
  "invalidCount": 0,
  "duplicateCount": 0,
  "completedAt": "2026-10-31T20:30:00.000Z"
}
```

---

### 3. Inspect Row Validation Errors

If a CSV contains malformed records (e.g. invalid date or amounts), row errors are quarantined in `import_row_errors` without failing the entire batch:

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/orgs/$orgId/imports/$importId/errors?page=1&limit=50" `
  -Method Get `
  -WebSession $session
```

---

### 4. Review Duplicate Candidates Quarantine

When duplicate `external_id`s occur within the same file or match transactions previously imported in the database, they are quarantined with status `FLAGGED`:

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/orgs/$orgId/duplicate-candidates?status=FLAGGED&page=1&limit=20" `
  -Method Get `
  -WebSession $session
```

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": "c138992a-8051-4f01-a757-5b23d915998a",
      "organizationId": "d3b07384-d113-4638-b7c1-0c5a2982d1a3",
      "importId": "e1438992-8051-4f01-a757-5b23d915998a",
      "dataSourceId": "7f09f2d0-3bc8-43d9-93e1-a987d6e49221",
      "existingTransactionId": "8f09f2d0-3bc8-43d9-93e1-a987d6e49229",
      "candidateFingerprint": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
      "externalId": "ORD-1001",
      "rowNumber": 10,
      "reason": "EXISTING_EXTERNAL_ID",
      "status": "FLAGGED",
      "createdAt": "2026-10-31T20:30:00.000Z",
      "updatedAt": "2026-10-31T20:30:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

---

## Deterministic Matching Engine (Phase A5)

The reconciliation matching engine is implemented as a standalone package located at `packages/matching` (`@reconcilex/matching`). It contains **zero external runtime dependencies** (no NestJS, no PostgreSQL, no MinIO, and no file IO) and can be executed synchronously in-process or inside a future BullMQ worker.

### Core Capabilities

1. **Rule 1: Currency Matching Barrier**:
   - Both transactions must have matching currencies (e.g., `USD` vs `USD`).
   - If currencies differ, the engine assigns a score of `0` (`NO_MATCH`) with `isEligible: false` and reason code `CURRENCY_MISMATCH`.

2. **Rule 2: Exact Reference + Exact Amount Minor**:
   - Normalized alphanumeric reference matching combined with identical `amount_minor`.
   - Produces a deterministic score of `100` (`EXACT`) with reason codes `['REFERENCE', 'AMOUNT']`.

3. **Rule 3: Multi-Attribute Confidence Scoring**:
   - **Amount Minor (30 pts)**: Exact integer minor unit match (`AMOUNT`).
   - **Date Proximity (20 pts)**: Exact calendar date match awards full 20 pts (`DATE`). Within configured tolerance (default 2 days), points taper linearly: day 0: 20 pts, day 1: 13 pts, day 2: 7 pts.
   - **Reference (50 pts / 30 pts)**: Exact normalized reference awards 50 pts (`REFERENCE`); containment awards 30 pts (`REFERENCE_SIMILAR`).
   - **External Identifiers (20 pts)**: Checks if external transaction ID or merchant/order ID matches across sets (`EXTERNAL_IDENTIFIER`).

4. **Confidence Classifications**:
   - `EXACT`: Score $\ge 100$
   - `POTENTIAL_STRONG`: Score $\ge 80$
   - `POTENTIAL`: Score $\ge 60$
   - `NO_MATCH`: Score $< 60$

5. **Greedy 1:1 Pairwise Assignment (`matchTwoSets`)**:
   - Compares an array of Source A transactions against Source B transactions.
   - Sorts candidate pairs by confidence score descending, then classification priority, then minimum date delta, then minimum amount delta, and finally stable ID tie-breakers.
   - Greedily locks in the highest-confidence pair and ensures neither transaction matches more than once (1:1 cardinality).
   - Generates deterministic results and comprehensive run statistics (`exactMatches`, `potentialStrongMatches`, `potentialMatches`, `totalAcceptedMatches`, `unmatchedACount`, `unmatchedBCount`).

---

## Current Scope & Limitations (Phase A5 Complete)

- **Completed**:
  - Phase A1 (Monorepo, HTTP foundation, logging, error envelope, health probes).
  - Phase A2 (Argon2id auth, cookie JWT, organizations, memberships, invitations, RBAC).
  - Phase A3 (Data sources catalog, canonical column mapping, transaction read APIs, composite DB isolation).
  - Phase A4 (MinIO S3 storage, streaming CSV parser, integer minor units, date normalization, row error isolation, content SHA-256 idempotency, duplicate candidate quarantine, sync JobService).
  - Phase A5 (Pure deterministic matching engine in `@reconcilex/matching`, explainable scoring, greedy 1:1 pairwise reconciliation, 37 engine unit tests, 120 total tests across 14 suites).
- **Next Up (Awaiting Approval)**:
  - Phase A6 (Reconciliation Runs & Results: DB schema, run orchestration, matches table, manual review & resolution APIs).
