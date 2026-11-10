# ReconcileX

ReconcileX is an enterprise-grade, multi-tenant financial transaction reconciliation platform. It is engineered to ingest, normalize, and match high-volume financial data across independent, heterogeneous systems—including internal Enterprise Resource Planning (ERP) databases, payment gateways (e.g., Stripe, Razorpay, PayU, Cashfree), commercial banking settlement statements, and physical/digital receipts or screenshot captures.

---

## Architecture at a Glance

```mermaid
flowchart TD
    subgraph Ingestion["1. Multi-Channel Data Ingestion"]
        CSV["Streaming CSV Parser<br/>(ERP, Gateways, Bank Feeds)"]
        OCR["Multimodal Vision & OCR<br/>(Receipts, POS, Mobile Slips)"]
        S3["Private S3 / MinIO<br/>(Fingerprinted Artifact Storage)"]
    end

    subgraph Processing["2. Normalization & Quarantine"]
        NORM["Minor Unit BigInt Normalization<br/>(ISO-4217 Currency Scaling)"]
        DEDUP["SHA-256 File & Txn Deduplication<br/>(Quarantine Discrepancies)"]
    end

    subgraph Engine["3. Native Multi-Source Matching Engine"]
        M2["2-Source Pairwise"]
        M3["3-Source Triplet Graph"]
        MN["N-Way Hyper-Edge Solver"]
    end

    subgraph Output["4. Resolution & Compliance"]
        MATCHES["Classified Match Matrix<br/>(Full, Partial, Amount/Date Discrepancies)"]
        EXCEPTIONS["Exception Management Queue<br/>(Open → Review → Escalation → Resolution)"]
        AUDIT["Immutable Audit Trail<br/>(Append-Only Actor & Entity Event Log)"]
    end

    CSV --> NORM
    OCR --> S3 --> NORM
    NORM --> DEDUP
    DEDUP --> Engine
    Engine --> MATCHES
    Engine --> EXCEPTIONS
    MATCHES --> AUDIT
    EXCEPTIONS --> AUDIT
```

---

# Part 1: Product Guide for Operations & Finance Teams

This section provides an operational overview for finance managers, business analysts, controllers, and compliance auditors.

## 1. Executive Summary

Modern businesses process payments across a sprawling ecosystem of shopping carts, payment service providers (PSPs), billing databases, and bank accounts. Inevitably, operational mismatches arise:

- Payment processor fees (MDR) lead to net deposit amounts differing from gross invoice totals.
- Batch settlement delays cause date slippages between transaction capture and bank credit.
- Reference numbers, UTRs, and order IDs are often truncated, hyphenated, or formatted inconsistently across vendors.
- Missing offline receipts or mobile payment screenshots require manual data entry and proof verification.

Manual reconciliation in spreadsheets quickly collapses under volume, lacks security controls, and produces un-auditable discrepancy records. **ReconcileX** solves these challenges by providing:

1. **Multi-Source Ingestion**: Ingest CSV files of any schema alongside physical receipts and mobile payment screenshots.
2. **Deterministic Multi-Source Reconciliation**: Execute 2-way, 3-way (e.g., _Internal Orders vs. Payment Gateway vs. Bank Settlement_), or arbitrary N-way matching in a single automated run.
3. **Automated Discrepancy Detection**: Immediately distinguish between perfect matches, timing delays, reference formatting variations, and monetary mismatches.
4. **Governed Exception Workflows**: Route unmatched records and discrepancies to human analysts with notes, assignment tracking, and supervisor escalation.
5. **Audit-Ready Compliance**: Enforce strict organization isolation and log every action in an append-only audit register.

---

## 2. Key Business Capabilities

### 2.1 Multi-Source CSV & Streaming Data Ingestion

- **Flexible Column Mapping**: Configure custom mappings for any external data source (Date, Amount, Currency, Reference, Gateway Transaction ID, Merchant/Order ID, and Transaction Type).
- **Format Normalization**: Automatically converts human-readable dates into ISO 8601 and parses floating-point currencies into integer minor units (e.g., converting `$14.99` to `1499` cents) to avoid rounding drift.
- **Deduplication & Quarantine**: Files are fingerprinted with SHA-256 upon arrival. Duplicate uploads are rejected immediately, while duplicate transaction candidates are quarantined for investigation rather than dropped silently.

### 2.2 Screenshot & Receipt Ingestion (OCR + Multimodal Vision)

Finance teams frequently receive payment proofs via email, chat, or WhatsApp screenshots (e.g., UPI payments, wire confirmations, point-of-sale terminal receipts, credit card charge slips). ReconcileX turns these images into reconciliation-ready transactions:

- **Dual-Engine Extraction**: Combines a local Tesseract OCR engine with an optional Google Gemini Multimodal Vision fallback for zero-shot transaction understanding.
- **Extracted Fields**: Extracts Transaction Date, Amount, ISO-4217 Currency, Reference/UTR ID, Merchant Name, Transaction Type (`PAYMENT`, `REFUND`, `TRANSFER`, `FEE`, `SALE`), and Description.
- **Confidence Scoring**: Computes an overall score (0–100%) and per-field confidence metrics (`amountConfidence`, `dateConfidence`, `referenceConfidence`).
- **Human-in-the-Loop Review**: Staged in a `REVIEW_REQUIRED` state where operators can view the original image in a split-screen interface, correct any field, and confirm the batch into a live `SCREENSHOT` data source.

### 2.3 Native Multi-Way Reconciliation Engine

Unlike traditional tools that only allow two files to be paired at a time, ReconcileX natively reconciles **two, three, four, or N data sources** simultaneously:

| Classification              | Meaning                                                                                                                            | Operational Action                                             |
| :-------------------------- | :--------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------- |
| **`FULLY_MATCHED`**         | Exact correspondence across amount, date tolerance, and reference identifiers across all sources.                                  | Auto-cleared and confirmed.                                    |
| **`PARTIALLY_MATCHED`**     | Transaction matched between a subset of sources (e.g., Order matches Gateway, but Bank deposit has not yet settled).               | Flagged for pending bank settlement.                           |
| **`AMOUNT_MISMATCH`**       | Identifiers and dates align, but minor unit totals differ (e.g., payment gateway MDR fee withheld or foreign exchange adjustment). | Highlighted with exact amount variance for fee verification.   |
| **`DATE_MISMATCH`**         | Reference and amount match, but transaction date falls outside the configured tolerance window.                                    | Flagged for timing variance review.                            |
| **`REFERENCE_MISMATCH`**    | Amounts match within the date window, but reference identifiers diverge or match only via fuzzy substring containment.             | Flagged for analyst confirmation.                              |
| **`POTENTIAL_MATCH`**       | Transaction pair/triplet scores above the potential threshold (default: 60%) but requires human inspection.                        | Presented in the review queue with confidence score breakdown. |
| **`UNMATCHED`**             | Transaction exists in one system with no corresponding record in other sources (e.g., unexpected bank service charge).             | Routed directly into the Exception Management Queue.           |
| **`DUPLICATE_QUARANTINED`** | Identified duplicate record isolated to prevent over-crediting or duplicate matching.                                              | Held in quarantine.                                            |

### 2.4 Exception Management Lifecycle

Discrepancies automatically generate exception records with a full operational lifecycle:

1. **`OPEN`**: Exception created and cataloged in the active queue.
2. **`ASSIGNED`**: Dispatched to a dedicated analyst for research.
3. **`UNDER_REVIEW`**: Analyst attaches investigation comments, links documentation, and tags root causes.
4. **`ESCALATED`**: Escalated to a finance manager or controller for review.
5. **`RESOLVED`**: Marked resolved using one of five standardized resolution actions:
   - `MANUALLY_RECONCILED`
   - `CONFIRMED_DUPLICATE`
   - `TRANSACTION_NOT_FOUND`
   - `DATA_CORRECTION`
   - `OTHER`

### 2.5 Role-Based Governance & Tenant Isolation

Each organization's workspace is strictly isolated. System access is governed by fine-grained roles:

| Role                  | Organization Settings | Data Source Config | CSV & Screenshot Upload | Execute Reconciliation | Confirm / Reject Matches |   Mutate Exceptions   | View Audit & Reports |
| :-------------------- | :-------------------: | :----------------: | :---------------------: | :--------------------: | :----------------------: | :-------------------: | :------------------: |
| **`ADMIN`**           |          Yes          |        Yes         |           Yes           |          Yes           |           Yes            | Yes (Full assignment) |         Yes          |
| **`FINANCE_MANAGER`** |       Read Only       |        Yes         |           Yes           |          Yes           |           Yes            |   Yes (Self-assign)   |         Yes          |
| **`ANALYST`**         |       Read Only       |     Read Only      |           Yes           |          Yes           |           Yes            |   Yes (Self-assign)   |         Yes          |
| **`AUDITOR`**         |       Read Only       |     Read Only      |        Read Only        |       Read Only        |        Read Only         |       Read Only       |         Yes          |

---

## 3. Operational Workflow

```
[ Step 1: Set Up Data Sources ]
Create Data Sources for your systems:
• Internal Ledger (ERP)
• Payment Gateway (Stripe, Razorpay, etc.)
• Bank Settlement Statement
• Screenshot / Receipt Uploads
               │
               ▼
[ Step 2: Upload Files & Screenshots ]
Upload CSV statement feeds or drag-and-drop receipt screenshots.
Review OCR extractions and confirm staged datasets.
               │
               ▼
[ Step 3: Configure & Launch Reconciliation ]
Select 2-Source, 3-Source, or N-Source mode.
Set date bounds, date tolerance window (e.g., ±2 days), and matching thresholds.
               │
               ▼
[ Step 4: Multi-Source Matrix Review ]
Inspect the match grid:
• Auto-confirm high-confidence and exact matches.
• Review and confirm/reject potential matches.
• View discrepancy breakdowns (amount difference, date offset, reference variation).
               │
               ▼
[ Step 5: Resolve Exceptions & Audit ]
Investigate unmatched items in the exception queue.
Collaborate via internal discussion threads.
Export compliance reports and inspect the immutable audit log.
```

---

## 4. Built-in Sample Dataset Walkthrough

ReconcileX includes a pre-configured sample dataset in the [`sample-data/`](file:///c:/Users/Pushkar%20Raj/Desktop/reconcile-x/sample-data) directory representing a realistic e-commerce financial flow:

| File                                                                                                        | Records | Represents                                    | Key Match Scenarios                                 |
| :---------------------------------------------------------------------------------------------------------- | :-----: | :-------------------------------------------- | :-------------------------------------------------- |
| [`internal_orders.csv`](file:///c:/Users/Pushkar%20Raj/Desktop/reconcile-x/sample-data/internal_orders.csv) |   24    | Internal ERP Order Ledger                     | Reference IDs `ORD-1001` through `ORD-1020`         |
| [`payment_gateway.csv`](file:///c:/Users/Pushkar%20Raj/Desktop/reconcile-x/sample-data/payment_gateway.csv) |   24    | Gateway Transactions (e.g. Razorpay / Stripe) | Captures, refunds, and gateway fee deductions       |
| [`bank_statement.csv`](file:///c:/Users/Pushkar%20Raj/Desktop/reconcile-x/sample-data/bank_statement.csv)   |   24    | Commercial Bank Deposit Statement             | Settlements, batch credits, interest, and bank fees |

### Scenario Breakdown in Sample Data:

- **Clean 3-Way Matches**: Transactions `ORD-1001` through `ORD-1012` match identically across Order Ledger, Payment Gateway, and Bank Statement.
- **Timing & Settlement Delays**: Orders `ORD-1013` through `ORD-1018` exhibit realistic settlement delays (1–3 days) between gateway authorization and bank account credit.
- **Amount & Fee Discrepancies**: Gateway processing fees deducted prior to net bank payout highlight automatic amount discrepancy detection.
- **Unmatched Exceptions**: Standalone transactions such as Bank Service Charges (`BNK-U001`), Unrecognized Remittances (`BNK-U002`), and Abandoned Checkouts (`ORD-1019`) route into the exception queue.

---

# Part 2: Technical Architecture & Developer Guide

This section provides technical documentation for software engineers, DevOps personnel, and system administrators.

## 1. Technical Stack

- **Runtime**: Node.js (v20.10.0+ or v22+)
- **Package Manager**: pnpm (Workspaces enabled)
- **Monorepo Architecture**: Modular TypeScript monorepo
- **Backend Application**: NestJS 10 (TypeScript in strict mode)
- **Database**: PostgreSQL 16
- **ORM & Migrations**: Drizzle ORM with Drizzle Kit
- **Object Storage**: S3-compatible storage (MinIO for local development, AWS S3 in cloud deployments)
- **OCR & Computer Vision**: Tesseract.js (local OCR) + Google Gemini 1.5 Flash Vision (multimodal zero-shot extraction)
- **Matching Engine**: Pure TypeScript, zero-dependency algorithmic matching engine (`@reconcilex/matching`)
- **CSV Ingestion**: High-throughput streaming parser (`@reconcilex/csv`)
- **Web Frontend**: React 18, Vite, React Router v6, TanStack Query v5, Tailwind CSS, Lucide icons
- **Authentication**: JWT access tokens and rotating refresh tokens via secure `httpOnly` cookies; Argon2id password hashing
- **Observability**: Pino structured JSON logging (`nestjs-pino`) with automatic credential redaction
- **Test Framework**: Vitest with SWC compiler, Testing Library for UI components
- **API Documentation**: OpenAPI 3.0 / Swagger UI (`/api/docs`)

---

## 2. Monorepo Structure

```
reconcile-x/
├── backend/
│   ├── api/                     # NestJS Core API Application (@reconcilex/api)
│   │   ├── src/
│   │   │   ├── common/          # Guards (OrgGuard, RolesGuard), decorators, filters
│   │   │   ├── config/          # Environment configuration (class-validator)
│   │   │   ├── database/        # Drizzle connection pool and provider
│   │   │   ├── health/          # Liveness & readiness probes (/api/v1/health)
│   │   │   └── modules/
│   │   │       ├── audit/       # Immutable audit trail module
│   │   │       ├── auth/        # Authentication, Argon2id, JWT & refresh tokens
│   │   │       ├── dashboard/   # Metrics aggregation and KPI endpoints
│   │   │       ├── data-sources/# Data source registry and column mapping
│   │   │       ├── exceptions/  # Exception management, transitions, comments
│   │   │       ├── imports/     # File uploads, CSV staging, row error tracking
│   │   │       ├── jobs/        # Asynchronous job tracking state machine
│   │   │       ├── organizations# Multi-tenant organization & membership management
│   │   │       ├── reconciliation/# Run orchestrator (2-way, 3-way, N-way)
│   │   │       ├── screenshot/  # Multimodal vision & Tesseract OCR pipeline
│   │   │       ├── storage/     # MinIO / AWS S3 client with presigned URLs
│   │   │       └── transactions/# Unified ledger query and pagination engine
│   │   └── test/                # E2E and integration test suites
│   ├── csv/                     # Streaming CSV ingestion and validator (@reconcilex/csv)
│   ├── db/                      # PostgreSQL Drizzle schema and migrations (@reconcilex/db)
│   └── matching/                # Algorithmic reconciliation engine (@reconcilex/matching)
│       ├── src/
│       │   ├── classify.ts      # Score-to-tier classification logic
│       │   ├── config.ts        # Tolerance windows and scoring weights
│       │   ├── match-two-sets.ts   # Deterministic pairwise matching
│       │   ├── match-three-sets.ts # Triplet candidate graph matching
│       │   ├── match-n-sets.ts     # Generalized N-source hyper-edge solver
│       │   ├── normalize.ts     # Currency, reference, and string sanitizers
│       │   └── scoring.ts       # Multi-attribute scoring formulas
│       └── tests/               # Matching unit test suites
├── frontend/                    # React 18 Single Page Application (@reconcilex/web)
│   ├── src/
│   │   ├── api/                 # Axios HTTP client, token refresh mutex, endpoints
│   │   ├── app/                 # Router definitions and permission route guards
│   │   ├── auth/                # AuthContext and permission definitions
│   │   ├── features/            # Feature modules (dashboard, reconciliation, screenshot,
│   │   │                        # exceptions, imports, data sources, audit, jobs, settings)
│   │   └── shared/              # Reusable UI components, modals, and formatters
├── infra/
│   └── docker/                  # Docker Compose definitions (PostgreSQL 16, MinIO)
├── sample-data/                 # Financial reconciliation test fixtures
│   ├── bank_statement.csv       # Bank settlement records
│   ├── internal_orders.csv      # Internal order records
│   └── payment_gateway.csv      # Payment gateway transaction logs
├── package.json                 # Monorepo root scripts & pnpm workspace config
└── pnpm-workspace.yaml          # Workspace package registry
```

---

## 3. Core Architectural Decisions (ADRs)

1. **Monetary Storage in Integer Minor Units (ADR 003)**:
   All financial amounts are stored as `BIGINT` minor units (e.g., cents, paise) paired with an ISO-4217 currency code. Floating-point types (`float`, `double`) are banned to eliminate binary rounding errors during reconciliation calculations.
2. **Native N-Source Matching Graph (ADR 004)**:
   ReconcileX supports 2-way, 3-way, and arbitrary N-way reconciliation. The matching engine constructs candidate bipartite and hyper-edge graphs across data sources, evaluating multi-dimensional scoring (amount delta, calendar day variance, reference normalizations, and external UTR/Gateway links) to produce explainable match groups.
3. **Dual Ingestion Pipeline (Streaming CSV + Multimodal OCR)**:
   Structured statement feeds stream through an event-driven CSV parser that validates every row against the source mapping. Unstructured visual evidence (receipts, mobile screenshots) is ingested into private S3 storage, processed via local OCR or Gemini Vision, and staged for human verification before entering the transaction catalog.
4. **Tenant Scoping & IDOR Prevention**:
   Every database query filters strictly by `organization_id`. To prevent existence enumeration attacks, the API returns HTTP 404 (Not Found) rather than 403 (Forbidden) whenever an authenticated user queries a resource outside their active organization.
5. **Persistent Job Tracking (ADR 005)**:
   Long-running tasks (large imports, heavy reconciliation runs) are tracked in a dedicated `jobs` table, following a strict state machine (`QUEUED` → `RUNNING` → `COMPLETED` / `FAILED`) with progress metrics and sanitized error outputs.
6. **Deduplication & Quarantine Architecture (ADR 006)**:
   Uploaded CSV files are fingerprinted via SHA-256 to prevent duplicate processing. Potential duplicate records are quarantined in `duplicate_candidates` rather than dropped, giving audit teams full visibility.
7. **Secure Ephemeral Object Storage (ADR 008)**:
   Receipt images and import statement artifacts are stored in private S3/MinIO buckets. Direct public access is disabled; the frontend views images via short-lived, time-limited presigned URLs.

---

## 4. Local Development Setup

### Prerequisites

Ensure you have the following installed:

- **Node.js**: `>= 20.10.0` or `>= 22.0.0`
- **pnpm**: `>= 9.0.0` (Recommended: `pnpm@12.x`)
- **Docker** and **Docker Compose**

### Step 1: Clone and Install Dependencies

```bash
git clone <repository-url>
cd reconcile-x
pnpm install
```

### Step 2: Configure Environment Variables

Create a `.env` file in the project root:

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

# JWT Authentication (32+ character secret)
JWT_SECRET=development-jwt-secret-minimum-32-chars-long-12345
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# PostgreSQL Database Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=reconcilex
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/reconcilex

# MinIO / S3 Object Storage Configuration
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001
MINIO_USE_SSL=false
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
MINIO_BUCKET=reconcilex-imports

# Optional: Google Gemini Vision API (for multimodal screenshot OCR)
# If omitted, ReconcileX automatically falls back to the built-in local Tesseract OCR engine.
GEMINI_API_KEY=
```

### Step 3: Start Local Infrastructure

Start PostgreSQL 16 and MinIO object storage using Docker Compose:

```bash
pnpm docker:up
```

Verify that both containers are running and healthy:

```bash
docker ps
```

_MinIO Web Console is accessible at `http://localhost:9001` (User: `minioadmin` / Pass: `minioadmin`)._

### Step 4: Run Database Migrations

Apply database schema migrations using Drizzle:

```bash
pnpm db:migrate
```

To create new migrations after modifying files in `backend/db/src/schema`:

```bash
pnpm db:generate
```

### Step 5: Start the Development Servers

Start both the backend API and frontend web application concurrently:

```bash
# Start backend API (Port 3000)
pnpm dev:api

# Start web frontend in a separate terminal (Port 5173)
pnpm dev:web
```

Alternatively, run the default dev target:

```bash
pnpm dev
```

- **Frontend App**: `http://localhost:5173`
- **Backend API**: `http://localhost:3000/api/v1`
- **Swagger Documentation**: `http://localhost:3000/api/docs`

---

## 5. Quickstart: Running 3-Way Reconciliation on Sample Data

1. **Sign Up**: Navigate to `http://localhost:5173/register`, create an account, and name your organization (e.g., _Acme Corp_).
2. **Create Data Sources**:
   Go to **Data Sources** → **New Data Source**:
   - Source 1: Name: `Internal Orders`, Type: `INTERNAL_ORDERS`
   - Source 2: Name: `Payment Gateway`, Type: `PAYMENT_GATEWAY`
   - Source 3: Name: `Bank Statement`, Type: `BANK`
3. **Upload Statements**:
   Navigate to **Imports** → **New Import**:
   - Upload [`sample-data/internal_orders.csv`](file:///c:/Users/Pushkar%20Raj/Desktop/reconcile-x/sample-data/internal_orders.csv) to `Internal Orders`.
   - Upload [`sample-data/payment_gateway.csv`](file:///c:/Users/Pushkar%20Raj/Desktop/reconcile-x/sample-data/payment_gateway.csv) to `Payment Gateway`.
   - Upload [`sample-data/bank_statement.csv`](file:///c:/Users/Pushkar%20Raj/Desktop/reconcile-x/sample-data/bank_statement.csv) to `Bank Statement`.
4. **Execute 3-Source Reconciliation**:
   Navigate to **Reconciliation** → **New Run**:
   - Select **3-Source Reconciliation**.
   - Select Source A (`Internal Orders`), Source B (`Payment Gateway`), and Source C (`Bank Statement`).
   - Set Date Range: `2026-09-01` to `2026-09-30`.
   - Click **Run Reconciliation**.
5. **Inspect Results**:
   View the match breakdown in the **Reconciliation Run Detail** page:
   - Filter by **Fully Matched** (12 clean matches across all 3 systems).
   - Filter by **Amount Mismatch** (transactions where gateway fees were deducted).
   - Review **Exceptions** to inspect unmatched bank fees and orphaned orders.

---

## 6. Testing & Code Quality

ReconcileX maintains high test coverage with automated unit, integration, and UI component tests:

```bash
# Run all test suites across the entire monorepo
pnpm test

# Run tests for specific packages
pnpm --filter @reconcilex/matching test      # Algorithmic matching tests (2-way, 3-way, N-way)
pnpm --filter @reconcilex/csv test           # CSV parser, validation, and minor unit tests
pnpm --filter @reconcilex/web test           # React components, permissions, and hooks
pnpm --filter @reconcilex/api test           # NestJS API controllers, guards, and services

# Run TypeScript compilation checks across all workspaces
pnpm typecheck

# Check code style and formatting
pnpm lint
pnpm format:check

# Auto-format codebase
pnpm format
```

---

## 7. Key REST API Endpoints

The API is fully documented with OpenAPI 3.0 at `/api/docs`. Below is a summary of core endpoints:

| Domain             | Method  | Endpoint                                                 | Description                                            |
| :----------------- | :------ | :------------------------------------------------------- | :----------------------------------------------------- |
| **Auth**           | `POST`  | `/api/v1/auth/register`                                  | Register new user and organization                     |
|                    | `POST`  | `/api/v1/auth/login`                                     | Authenticate and obtain session cookies                |
|                    | `POST`  | `/api/v1/auth/refresh`                                   | Rotate JWT access token via refresh cookie             |
| **Data Sources**   | `GET`   | `/api/v1/orgs/:orgId/data-sources`                       | List configured data sources                           |
|                    | `POST`  | `/api/v1/orgs/:orgId/data-sources`                       | Create a new data source with column mapping           |
| **Imports**        | `POST`  | `/api/v1/orgs/:orgId/imports`                            | Upload and stream-validate statement CSV               |
|                    | `GET`   | `/api/v1/orgs/:orgId/imports/:id`                        | Get import status and row error counts                 |
| **Screenshots**    | `POST`  | `/api/v1/orgs/:orgId/screenshot/datasets`                | Batch upload receipt screenshots for OCR               |
|                    | `GET`   | `/api/v1/orgs/:orgId/screenshot/datasets/:id`            | Get dataset details and extracted records              |
|                    | `PATCH` | `/api/v1/orgs/:orgId/screenshot/records/:id`             | Human correction of OCR extracted fields               |
|                    | `POST`  | `/api/v1/orgs/:orgId/screenshot/datasets/:id/confirm`    | Confirm dataset into active transactions               |
| **Reconciliation** | `POST`  | `/api/v1/orgs/:orgId/reconciliation/runs`                | Launch 2-Way, 3-Way, or 4-Way reconciliation run       |
|                    | `GET`   | `/api/v1/orgs/:orgId/reconciliation/runs/:id`            | Retrieve run metrics, status, and match groups         |
|                    | `POST`  | `/api/v1/orgs/:orgId/reconciliation/matches/:id/confirm` | Manually confirm a potential match                     |
| **Exceptions**     | `GET`   | `/api/v1/orgs/:orgId/exceptions`                         | Paginated query of reconciliation exceptions           |
|                    | `PATCH` | `/api/v1/orgs/:orgId/exceptions/:id/status`              | Update exception status (`ASSIGNED`, `RESOLVED`, etc.) |
|                    | `POST`  | `/api/v1/orgs/:orgId/exceptions/:id/comments`            | Add investigation note or comment                      |
| **Jobs**           | `GET`   | `/api/v1/orgs/:orgId/jobs/:id`                           | Poll asynchronous job execution progress               |
| **Audit**          | `GET`   | `/api/v1/orgs/:orgId/audit-logs`                         | Query append-only audit trail with entity diffs        |
| **Health**         | `GET`   | `/api/v1/health`                                         | Liveness probe                                         |
|                    | `GET`   | `/api/v1/health/ready`                                   | Readiness probe (verifies database connectivity)       |

---

## 8. License

This project is licensed under the MIT License.
