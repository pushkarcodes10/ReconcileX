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
│       │   │   └── organizations/     # Multi-tenancy, memberships, invitations
│       │   ├── app.module.ts          # Main application module
│       │   └── main.ts                # Bootstrap, cookie parser & Swagger
│       ├── test/                      # Vitest test suite (30 unit & integration tests)
│       ├── package.json
│       ├── tsconfig.json
│       └── vitest.config.ts
├── packages/
│   └── db/
│       ├── drizzle/                   # Drizzle migration files (.sql)
│       ├── src/
│       │   ├── schema/                # Users, orgs, memberships, tokens, resets
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

### 3. Database Migration & Docker

Start PostgreSQL container:

```powershell
pnpm run docker:up
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
# Run all Vitest unit and integration tests (30 tests across 6 suites)
pnpm test

# Run TypeScript typechecking across all workspace packages
pnpm run typecheck

# Run ESLint
pnpm run lint

# Verify Prettier code style
pnpm run format:check
```

---

## End-to-End API Testing Guide (Phase A2)

Use the following PowerShell or `curl` commands to test the full authentication and organization lifecycle.

### 1. User & Organization Registration

Registers a new user, creates their initial organization, and assigns them the `ADMIN` role.

```powershell
$registerBody = @{
  email = "alice@acme.com"
  password = "SecurePassword123!"
  name = "Alice Admin"
  organizationName = "Acme Corp"
} | ConvertTo-Json

$registerResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/register" `
  -Method Post `
  -ContentType "application/json" `
  -Body $registerBody `
  -SessionVariable session

$registerResponse
```

**Expected Response (201 Created):**

```json
{
  "user": {
    "id": "...",
    "email": "alice@acme.com",
    "name": "Alice Admin",
    "status": "ACTIVE"
  },
  "organization": {
    "id": "...",
    "name": "Acme Corp",
    "slug": "acme-corp",
    "role": "ADMIN"
  }
}
```

_Note: Sets `httpOnly` cookies for `access_token` and `refresh_token`._

---

### 2. User Login

```powershell
$loginBody = @{
  email = "alice@acme.com"
  password = "SecurePassword123!"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/login" `
  -Method Post `
  -ContentType "application/json" `
  -Body $loginBody `
  -SessionVariable session

$loginResponse
```

**Expected Response (200 OK):**

```json
{
  "user": {
    "id": "...",
    "email": "alice@acme.com",
    "name": "Alice Admin",
    "status": "ACTIVE"
  },
  "memberships": [
    {
      "organizationId": "...",
      "organizationName": "Acme Corp",
      "organizationSlug": "acme-corp",
      "role": "ADMIN"
    }
  ]
}
```

---

### 3. Get Authenticated Profile (`/auth/me`)

Uses the active session cookies:

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/me" `
  -Method Get `
  -WebSession $session
```

---

### 4. Rotate Access Token via Refresh Token

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/refresh" `
  -Method Post `
  -WebSession $session
```

**Expected Response (200 OK):**

```json
{
  "success": true
}
```

_Note: Automatically rotates both the access token and the refresh token cookie. Old refresh tokens are invalidated._

---

### 5. Multi-Tenant Organization Management

#### List organizations:

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/organizations" `
  -Method Get `
  -WebSession $session
```

#### Update organization name (Admin only):

```powershell
$orgId = $loginResponse.memberships[0].organizationId

$updateBody = @{
  name = "Acme Global Industries"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/v1/organizations/$orgId" `
  -Method Patch `
  -ContentType "application/json" `
  -Body $updateBody `
  -WebSession $session
```

---

### 6. Member Invitations & RBAC

#### Invite a new member as `ANALYST`:

```powershell
$inviteBody = @{
  email = "bob@acme.com"
  role = "ANALYST"
} | ConvertTo-Json

$invite = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/organizations/$orgId/invitations" `
  -Method Post `
  -ContentType "application/json" `
  -Body $inviteBody `
  -WebSession $session

$invite
```

**Expected Response (201 Created):**

```json
{
  "id": "...",
  "organizationId": "...",
  "email": "bob@acme.com",
  "role": "ANALYST",
  "token": "...",
  "expiresAt": "..."
}
```

#### Accept the invitation (registering Bob):

```powershell
$acceptBody = @{
  token = $invite.token
  password = "BobSecurePassword123!"
  name = "Bob Analyst"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/v1/invitations/accept" `
  -Method Post `
  -ContentType "application/json" `
  -Body $acceptBody
```

---

### 7. Tenant Isolation Verification (IDOR Protection)

When a user in Organization A attempts to access Organization B's members or resources:

```powershell
$fakeOrgId = [guid]::NewGuid().ToString()

try {
  Invoke-RestMethod -Uri "http://localhost:3000/api/v1/organizations/$fakeOrgId/members" `
    -Method Get `
    -WebSession $session
} catch {
  $_.Exception.Response.StatusCode # Returns 404 (Not Found)
}
```

_Note: Returns `404 Not Found` rather than `403 Forbidden` to prevent malicious tenant enumeration._

---

### 8. Logout & Session Invalidation

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/logout" `
  -Method Post `
  -WebSession $session
```

_Note: Clears the cookies and marks the refresh token revoked in the database._
