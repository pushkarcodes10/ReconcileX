# ReconcileX — Frontend Implementation Plan

**Status:** Planning only (no frontend implementation in this document’s delivery).  
**Source of truth:** Local repository at `C:\Users\Pushkar Raj\Desktop\reconcile-x` (A1–A8 backend complete). GitHub (`https://github.com/pushkarcodes10/ReconcileX`) was named as the latest remote; this plan is based on the local tree’s controllers, DTOs, guards, and schema.  
**Related docs:** [backend_plan.md](backend_plan.md), [ReconcileX_PRD.md](ReconcileX_PRD.md).  
**Out of scope:** Milestone B (BullMQ, reports, extra security/perf, CI/CD, OpenTelemetry). Visual design (colors, typography, layout appearance) is deferred until a separate design reference.

---

## 1. Project understanding

ReconcileX is a multi-tenant reconciliation platform. The backend is a NestJS modular monolith (`apps/api`) with PostgreSQL (Drizzle), MinIO for CSV objects, and in-process sync jobs for CSV import and pairwise reconciliation.

The frontend’s job is to consume existing HTTP APIs so a user can:

1. Register or log in (httpOnly JWT cookies).
2. Work inside an organization with a role (`ADMIN`, `FINANCE_MANAGER`, `ANALYST`, `AUDITOR`).
3. Configure data sources and column mappings.
4. Upload CSVs, inspect import errors and duplicate candidates.
5. Browse transactions (read-only).
6. Start a two-source reconciliation run and review exact / potential / unmatched results.
7. Confirm or reject potential matches.
8. Drive the exception state machine (assign, comment, review, escalate, resolve, reopen).
9. Read dashboard aggregates, audit logs, and job status.

The frontend must **not** reimplement matching, validation, or the exception FSM. It must **not** store JWTs in `localStorage`. It must **not** invent metrics or mock production data after integration.

---

## 2. Existing backend capabilities

API prefix: `http://localhost:3000/api/v1` (`PORT=3000`, `API_PREFIX=api/v1`).  
Swagger: `http://localhost:3000/api/docs`.  
Auth: cookie `access_token` (15m, httpOnly, SameSite=Lax) + `refresh_token` (7d). Bearer header is accepted as fallback; the UI must use cookies with `credentials: 'include'`.  
Org context: path param `:orgId` on almost all resource routes. `OrgGuard` also accepts `X-Organization-Id` if `:orgId` is missing. Wrong org → **404** (not 403) to avoid IDOR probing.  
Error envelope (all failures):

```json
{ "error": { "code": "UNAUTHORIZED", "message": "...", "details": null, "requestId": "..." } }
```

Validation failures: `code` typically `BAD_REQUEST`, `message` `"Validation failed"`, `details` array of class-validator strings.

### 2.1 Authentication (`AuthController`)

| Method | Path | Auth | Body / notes | Success |
|---|---|---|---|---|
| POST | `/auth/register` | Public | `{ name, email, password, orgName }` — name/orgName min 2, password min 8 | 201 `{ user, organization }` + Set-Cookie. User becomes ADMIN of new org. 409 if email exists. |
| POST | `/auth/login` | Public | `{ email, password }` | 200 `{ user, memberships[] }` + Set-Cookie. 401 generic invalid credentials. **No rate limiter in code.** |
| POST | `/auth/logout` | JWT | Refresh cookie revoked | 200 `{ success, message }` + clear cookies |
| POST | `/auth/refresh` | Refresh cookie | No body | 200 `{ success: true }` + rotated cookies. 401 if missing/invalid refresh. |
| POST | `/auth/password-reset/request` | Public | `{ email }` | 202 always. Body may include `resetToken` when the email exists (**no email send**; token is in JSON). |
| POST | `/auth/password-reset/confirm` | Public | `{ token, newPassword }` | 200 or 400 expired/invalid |
| GET | `/auth/me` | JWT | — | `{ user: { id, email, name, status }, memberships: [{ membershipId, organizationId, orgName, orgSlug, role }] }` |

JWT payload does **not** include org or role. Role comes from membership after `OrgGuard`.

### 2.2 Organizations (`OrganizationsController`)

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/organizations` | Any authenticated | List orgs the user belongs to |
| PATCH | `/organizations/:orgId` | ADMIN | Body `{ name? }` |
| GET | `/organizations/:orgId/members` | **ADMIN only** | Member directory |
| POST | `/organizations/:orgId/invitations` | ADMIN | `{ email, role }` → returns `{ id, email, role, expiresAt, inviteToken }` (**token in JSON; no email**) |
| POST | `/invitations/accept` | **Public** (no `JwtAuthGuard`) | `{ token, name?, password? }`. New users need name+password. Does **not** set cookies. `req.user` is never populated. |
| PATCH | `/organizations/:orgId/members/:userId` | ADMIN | `{ role }` — last-admin protection → 400 |
| DELETE | `/organizations/:orgId/members/:userId` | ADMIN | Last-admin protection → 400 |

There is **no** `GET /organizations/:orgId` detail endpoint beyond membership list + `GET /auth/me`.

### 2.3 Data sources

Base: `/orgs/:orgId/data-sources` (alias `/organizations/:orgId/data-sources`).

| Method | Roles | Notes |
|---|---|---|
| POST `/` | ADMIN, FINANCE_MANAGER | `{ name, type, columnMapping, direction? }`. Required mapping: `external_id`, `amount`, `date`, `currency`. Optional: `reference`, `external_txn_id`, `merchant_or_order_id`, `txn_type`. Types: `INTERNAL_ORDERS \| PAYMENT_GATEWAY \| BANK \| OTHER`. 409 duplicate name. |
| GET `/` | All roles | Query: `type`, `status`, `page`, `limit`. **Response shape varies:** array if no `page`/`limit`; paginated `{ data, total, page, limit, totalPages }` if those query params are set. Frontend should always send `page`+`limit`. |
| GET `/:id` | All roles | 404 if missing/other org |
| PATCH `/:id` | ADMIN, FINANCE_MANAGER | name, type, columnMapping, status (`ACTIVE \| INACTIVE \| ARCHIVED`) |
| DELETE `/:id` | ADMIN, FINANCE_MANAGER | Soft delete; **409** if transactions exist |

### 2.4 Imports and duplicates

Base: `/orgs/:orgId`. Upload roles: ADMIN, FINANCE_MANAGER, ANALYST. List endpoints have **no `@Roles`**, so any org member (including AUDITOR) can read imports.

| Method | Path | Notes |
|---|---|---|
| POST | `/data-sources/:id/imports` | Multipart field name **`file`**. 202 `{ jobId, importId, status, duplicateFile? }`. 400 invalid file, 413 > 50MB. Processing is **synchronous in-process** (`SyncJobService`); 202 may already be COMPLETED. |
| GET | `/imports` | Query: `dataSourceId`, `status`, `page`, `limit`. Pagination is **flat** (`data, total, page, limit, totalPages`) — not `{ meta }`. |
| GET | `/imports/:id` | Import counters and `errorSummary` |
| GET | `/imports/:id/errors` | Row errors: `rowNumber`, `field`, `code`, `rawValue`, `message` |
| GET | `/imports/:id/status` | Status/progress counters |
| GET | `/duplicate-candidates` | Query: `importId`, `dataSourceId`, `status` (`FLAGGED \| DISMISSED \| CONFIRMED_DUPLICATE`), pagination |

**Missing:** POST/PATCH to dismiss or confirm a duplicate candidate. UI is **read-only quarantine**.

Import statuses: `QUEUED | PROCESSING | COMPLETED | FAILED`.

### 2.5 Transactions (read-only)

`GET /orgs/:orgId/transactions` — all roles. Query: `sourceId` (alias `dataSourceId`), `importId`, `dateFrom`/`dateTo`, `amount` (**minor units**), `status`, `q` (external_id/reference), `cursor` **or** `page`, `limit` (max 100), `sortBy` (`transactionDate | createdAt | amountMinor`), `sortOrder`.

`GET /orgs/:orgId/transactions/:id` — detail including normalized payload.

**No create/update/delete transaction APIs.** Statuses: `IMPORTED | VALIDATED | UNMATCHED | MATCHED | POTENTIAL_MATCH | EXCEPTION | RESOLVED`.

### 2.6 Reconciliation

Roles: create/confirm/reject = ADMIN, FINANCE_MANAGER, ANALYST. Reads = all roles.

| Method | Path | Notes |
|---|---|---|
| POST | `/reconciliation-runs` | Body `{ sourceA, sourceB, dateFrom, dateTo, config?: { dateWindowDays, potentialThreshold, exactThreshold } }`. Optional header `Idempotency-Key`. 201 `{ jobId, runId, status, run }`. 400 same source / bad dates. 409 processing or idempotency conflict. Sync in-process. |
| GET | `/reconciliation-runs` | Query: `status`, `sourceId`, `dateFrom`, `dateTo`, `page`, `limit`, `sortBy`, `sortOrder`. Paginated **flat** + `hasMore`. |
| GET | `/reconciliation-runs/:id` | Counters + source summaries |
| GET | `/reconciliation-runs/:id/matches` | Query: `classification` (`EXACT \| POTENTIAL`), `status` (`PENDING \| CONFIRMED \| REJECTED`), page, limit. Each match includes `score`, `reasons`, `transactionA`, `transactionB`. |
| GET | `/reconciliation-runs/:id/unmatched` | page, limit only |
| POST | `/matches/:id/confirm` | Potential → confirmed. 400 if not POTENTIAL. 409 already decided. |
| POST | `/matches/:id/reject` | Body `{ reason? }` max 1000 chars |

Run statuses: `PENDING | PROCESSING | COMPLETED | FAILED`.  
There is **no** CRUD API for “saved reconciliation configurations”. Config is a snapshot on each run.

### 2.7 Exceptions (FSM is backend-owned)

Reads: all roles. Mutations: ADMIN, FINANCE_MANAGER, ANALYST (AUDITOR cannot assign/comment/transition).

| Method | Path | Notes |
|---|---|---|
| GET | `/exceptions` | Query: `status`, `assigneeId`, `runId`, `createdFrom`, `createdTo`, `q`, `page`, `limit`, `sortBy`, `sortOrder`. Response `{ data, meta }`. |
| GET | `/exceptions/:id` | Includes comments, assignee, transaction, run |
| POST | `/exceptions/:id/assign` | `{ assigneeId }` UUID of **org member**. Reassign allowed except RESOLVED. |
| POST | `/exceptions/:id/comments` | `{ body }` max 5000. 201 |
| POST | `/exceptions/:id/status` | `{ action, resolutionReason?, resolutionAction? }` |

**Actions (frontend must send these strings, not invent others):**

- `START_REVIEW` — OPEN or ASSIGNED or ESCALATED → UNDER_REVIEW  
- `ESCALATE` — ASSIGNED or UNDER_REVIEW → ESCALATED  
- `RESOLVE` — UNDER_REVIEW or ESCALATED → RESOLVED; **requires** `resolutionReason` (min 5, max 2000) and `resolutionAction` enum  
- `REOPEN` — RESOLVED → OPEN  

Assignment is a **separate** endpoint, not a status action. Invalid transition → **409** `INVALID_EXCEPTION_TRANSITION`.

`ResolutionAction`: `MANUALLY_RECONCILED | CONFIRMED_DUPLICATE | TRANSACTION_NOT_FOUND | DATA_CORRECTION | OTHER`.

Frontend may hide illegal buttons using the same table for UX, but the API remains authoritative.

### 2.8 Dashboard

All roles. Four endpoints — **do not invent extra metrics**.

| Path | Query | Payload (fields that exist) |
|---|---|---|
| GET `/dashboard/summary` | — | `totalTransactions`, `totalReconciliationRuns`, `completedRuns`, `failedRuns`, `runningRuns`, `totalMatchedTransactions`, `totalUnmatchedTransactions`, `totalPotentialMatches`, `totalOpenExceptions`, `totalAssignedExceptions`, `totalExceptionsUnderReview`, `totalEscalatedExceptions`, `totalResolvedExceptions` |
| GET `/dashboard/reconciliation` | `startDate`, `endDate` | `totalRuns`, `completedRuns`, `failedRuns`, `runningRuns`, `matchCounts { exact, potential, confirmed, rejected }`, `recentRuns[]` |
| GET `/dashboard/exceptions` | — | `byStatus`, `unassignedCount`, `byAssignee[]`, `recentCreated[]`, `recentResolved[]` |
| GET `/dashboard/activity` | `action`, `page`, `limit` | Activity feed from audit logs |

**No date filter on summary or exceptions.** Jobs are **not** part of dashboard APIs.

### 2.9 Audit logs

All four roles can GET (PRD “analyst limited” is **not** implemented — no actor-scoped filter).

- `GET /audit-logs` — filters: `action`, `entityType`, `entityId`, `actorId`, `startDate`, `endDate`, `page`, `limit`, `sortBy=createdAt`, `sortOrder`. `{ data, meta }`.
- `GET /audit-logs/:id` — single record with `actor`, `metadata`, `ipAddress`, `userAgent`.

No PATCH/DELETE (immutable).

### 2.10 Jobs

All roles.

- `GET /jobs` — `status`, `jobType`, `referenceType`, `referenceId`, `startDate`, `endDate`, `page`, `limit`, `sortBy`, `sortOrder`. `{ data, meta }`.
- `GET /jobs/:id` — `progress` (integer 0–100), `message`, `result`, `error`, timestamps.

`JobType`: `RECONCILIATION_RUN | CSV_IMPORT`.  
`JobStatus`: `QUEUED | RUNNING | COMPLETED | FAILED` (**not** `PROCESSING`; runs use `PROCESSING`, jobs use `RUNNING`).  
No `DEAD_LETTER` yet.

### 2.11 Health (public)

- `GET /health` (liveness; note: global prefix applies → `/api/v1/health` unless excluded — controller is under global prefix).
- `GET /health/ready` — 200/503 database check.

### 2.12 Role matrix (enforced on server)

| Capability | Admin | Finance Manager | Analyst | Auditor |
|---|---|---|---|---|
| Dashboard, txns, runs (read), matches, unmatched, exceptions (read), audit, jobs | yes | yes | yes | yes |
| Upload CSV / start run / confirm-reject / exception mutate | yes | yes | yes | no |
| Data source write/delete | yes | yes | no | no |
| Members, invites, org rename | yes | no | no | no |

Hide nav/actions in the UI to match this table. Never rely on hiding as security.

---

## 3. Existing frontend status

**No frontend application exists.**

- `pnpm-workspace.yaml` includes `apps/*` and `packages/*`.
- Present apps/packages: `apps/api`, `packages/db`, `packages/csv`, `packages/matching`.
- No `apps/web`, no React/Vite config, no shared frontend types package.
- Root scripts only run the API (`pnpm dev` → `@reconcilex/api`).
- Root ESLint is TypeScript-eslint recommended; `tsconfig.base.json` is Nest/CommonJS-oriented (frontend must use its own TS config).
- README is empty.

---

## 4. Recommended frontend technology stack

Recommendations (need confirmation only if you want a different UI kit after the design reference arrives):

| Choice | Recommendation | Why |
|---|---|---|
| App location | `apps/web` in the existing pnpm workspace | Matches monorepo; no backend restructure |
| Runtime | React + TypeScript (strict) + Vite | Fits Nest/TS repo; fast DX; Vite proxy solves cookie CORS |
| Routing | React Router | Org-scoped URL ` /orgs/:orgId/... ` |
| Server state | TanStack Query | Pagination, polling, invalidation after mutations |
| HTTP | `fetch` wrapper (no axios unless you insist) | Cookies + FormData; keep deps small |
| Client validation | Zod | Mirror DTO rules; do not duplicate matching/FSM |
| Unit/component tests | Vitest + Testing Library | Same test runner as API |
| E2E | Playwright against real API | Cookie flows, RBAC |
| Styling | **Deferred** until design reference | Do not choose Tailwind/theme now. Use semantic markup and unstyled structure in F0–F7; apply the design file in a later pass |

Do **not** add Redux, WebSockets, GraphQL, or a component library until the design reference requires one.

---

## 5. Frontend architecture

```text
Browser (Vite :5173)
  → /api/v1/*  (Vite proxy, same-origin cookies)
    → Nest API :3000
```

**Layers**

1. **API client** — `credentials: 'include'`, prefix `/api/v1`, maps HTTP errors to a typed `ApiError`. On 401, try `POST /auth/refresh` once, then retry; if refresh fails, clear session and route to login.
2. **Query hooks** — one hook family per resource; `queryKey` includes `orgId` and filters.
3. **Auth/org providers** — bootstrap `GET /auth/me`; persist **selected orgId** in `sessionStorage` (not tokens). Role for current org derived from `memberships`.
4. **Route guards** — unauthenticated → login; authenticated without org → org picker; role-gated routes → not-found or forbidden page (do not leak other-org URLs).
5. **Feature modules** — pages + hooks + forms colocated; shared table/pagination/empty/error primitives without visual styling contracts.

**Org in the URL:** every tenant page is `/orgs/:orgId/...`. Switching org changes the path and QueryClient scope (invalidate or use orgId in keys). Do not send `X-Organization-Id` unless a route lacks `:orgId` (none of the product APIs need it if URLs are correct).

**Money:** always treat `amountMinor` as integer minor units. Format for display in the UI layer; send integers back if filtering by amount.

**Pagination adapter:** normalize both `{ data, meta }` and `{ data, total, page, limit, totalPages, hasMore? }` into `{ items, page, limit, total, totalPages }`.

---

## 6. Proposed folder structure

```text
apps/web/
  package.json                 # @reconcilex/web
  index.html
  vite.config.ts               # proxy /api -> http://localhost:3000
  tsconfig.json                # strict, bundler module resolution
  src/
    main.tsx
    app/
      router.tsx               # route table
      providers.tsx            # QueryClient, Auth, Org
      route-guards.tsx
    api/
      client.ts                # fetch + refresh mutex
      errors.ts
      pagination.ts
      types.ts                 # request/response types aligned to DTOs
      endpoints/
        auth.ts
        organizations.ts
        data-sources.ts
        imports.ts
        transactions.ts
        reconciliation.ts
        exceptions.ts
        dashboard.ts
        audit.ts
        jobs.ts
    auth/
      auth-provider.tsx
      permissions.ts           # role → capability map (UX only)
    org/
      org-provider.tsx
    features/
      auth/                    # login, register, reset, accept-invite
      shell/                   # authenticated layout, nav, account menu
      dashboard/
      data-sources/
      imports/
      transactions/
      reconciliation/
      exceptions/
      audit/
      jobs/
      settings/                # org name, members, invites (ADMIN)
    shared/
      components/              # Table, Pagination, Filters, FileInput, JobStatus, Empty, Error, PageState
      hooks/
      forms/                   # zod helpers
      lib/                     # amount, date, idempotency-key
    test/
      setup.ts
```

**Directory responsibilities**

- `api/` — only place that knows URLs and cookies.  
- `auth/` + `org/` — session and tenant context.  
- `features/*` — screens and feature hooks.  
- `shared/` — reuse without depending on a design system yet.  
- Tests live next to features (`*.test.tsx`) plus `e2e/` at `apps/web/e2e`.

Workspace changes (F0): add `apps/web` to pnpm (already covered by `apps/*`); add root scripts `dev:web`, `dev:api`. **Do not change Nest modules.**

---

## 7. API integration strategy

### Client

- `baseURL`: `import.meta.env.VITE_API_BASE_URL ?? '/api/v1'`.
- Vite proxy: `'/api' → 'http://localhost:3000'` so cookies are first-party.
- `credentials: 'include'` on every call.
- Do not read or write `access_token` / `refresh_token` from JavaScript.
- Single-flight refresh: concurrent 401s wait on one `POST /auth/refresh`.
- AbortController via TanStack Query `signal`.
- File upload: `FormData` with key `file`; do not set `Content-Type` (browser sets boundary).
- Mutations that create runs: header `Idempotency-Key: <uuid>` stored until success/explicit retry.
- Default `CORS_ORIGIN=*` **with credentials is unsafe in browsers**. Proxy avoids this. If calling the API origin directly, backend `CORS_ORIGIN` must be the exact Vite origin (e.g. `http://localhost:5173`) and `allowedHeaders` should include `Idempotency-Key` (today: `Content-Type, Authorization, X-Request-Id` only). Treat CORS header gap as a **backend follow-up**, not a frontend prerequisite if proxy is used.

### Types

Hand-written TypeScript types in `apps/web/src/api/types.ts` copied from API DTOs. Do not import Nest classes. Optional later: generate from `/api/docs-json`.

### Caching / invalidation

| Mutation | Invalidate |
|---|---|
| Login/register | seed `['auth','me']` |
| Import upload | `imports`, `transactions`, `jobs`, `dashboard`, `duplicate-candidates` |
| Create run | `runs`, `jobs`, `dashboard`, `exceptions`, `transactions` |
| Confirm/reject match | that run’s matches + unmatched, transactions, dashboard |
| Exception assign/comment/status | exception detail + list + dashboard + audit |
| Data source CRUD | data-sources |
| Member/invite | members |

### Polling

Only while `job.status` is `QUEUED` or `RUNNING`, or run/import `PENDING`/`PROCESSING`. Interval ~2s, stop on `COMPLETED`/`FAILED`. Sync jobs often finish before the first poll — still poll once if the create response is not terminal.

### Forms

Zod on the client for required fields and lengths; backend remains source of truth (422/400/409). Show `error.message` and `error.details`.

---

## 8. Complete F0–F8 implementation roadmap

### Phase F0 — Frontend foundation

**Objective:** Runnable `apps/web` in the monorepo talking to the API through a typed client.  
**Complexity:** Medium.

**Features:** Vite+React+TS app; env `VITE_API_BASE_URL`; proxy; `api/client.ts` with error mapping and refresh; pagination helper; QueryClient; health ping optional; scripts `pnpm --filter @reconcilex/web dev`.

**APIs:** `GET /health` (smoke). No product UI required.

**Likely files:** `apps/web/**` skeleton listed in §6 (`main`, `client`, `types` stubs). Root `package.json` script additions only.

**Depends on:** nothing.

**Tests:** client maps `{ error: { code, message } }` ; 401 refresh retry unit test with mocked fetch.

**DoD:** `pnpm --filter @reconcilex/web dev` starts; a throwaway call to `/health` works via proxy; TypeScript strict passes for the skeleton.

---

### Phase F1 — Authentication and organization

**Objective:** Cookie session, bootstrap user, org selection, invite accept, password reset using real APIs.  
**Complexity:** High.

**Features:**

- Register (`name, email, password, orgName`) → cookies set → land in new org.
- Login → if one membership, select it; if many, org picker (`GET /organizations` or `memberships` from login/`me`).
- Logout.
- `GET /auth/me` on app load; if 401, try refresh, else public routes.
- Protected routes.
- Password reset: request (show token **only if API returns `resetToken`** — it currently does) + confirm.
- Accept invitation page (`/invitations/accept?token=`): public form; then prompt login (accept does not set cookies).
- Expired access: silent refresh; expired refresh: login with return URL.

**APIs:** all `/auth/*`, `GET /organizations`, `POST /invitations/accept`.

**Files:** `features/auth/*`, `auth/auth-provider.tsx`, `org/org-provider.tsx`, `permissions.ts`.

**Depends on:** F0.

**Tests:** login sets session via mocked `/auth/me`; 401 after failed refresh redirects; register conflict 409 shown.

**DoD:** Real register/login/logout against API; no tokens in localStorage; orgId in session + URL.

---

### Phase F2 — Application shell and navigation

**Objective:** Authenticated shell, org-scoped routes, permission-aware nav. **No visual design.**  
**Complexity:** Medium.

**Features:** Layout with outlet; nav entries gated by role; account + logout; org switcher (changes `/orgs/:orgId`); forbidden state for AUDITOR hitting `/imports/new`; 404 for unknown routes.

**Suggested routes (functional, not visual):**

```text
/login /register /forgot-password /reset-password /invitations/accept
/orgs/:orgId/dashboard
/orgs/:orgId/data-sources
/orgs/:orgId/data-sources/:id
/orgs/:orgId/imports
/orgs/:orgId/imports/new
/orgs/:orgId/imports/:id
/orgs/:orgId/transactions
/orgs/:orgId/transactions/:id
/orgs/:orgId/reconciliation
/orgs/:orgId/reconciliation/new
/orgs/:orgId/reconciliation/:runId
/orgs/:orgId/exceptions
/orgs/:orgId/exceptions/:id
/orgs/:orgId/audit
/orgs/:orgId/jobs
/orgs/:orgId/jobs/:id
/orgs/:orgId/settings          # ADMIN
```

**APIs:** `GET /auth/me` only (no new product APIs).

**Depends on:** F1.

**Tests:** auditor does not get “New import” / “Start run” links; org switch changes subsequent API orgId.

**DoD:** All routes exist as placeholders or real pages; guards work.

---

### Phase F3 — Dashboard

**Objective:** Live dashboard from the four dashboard endpoints.  
**Complexity:** Medium.

**Features:** Load `summary`, `reconciliation`, `exceptions`, `activity` in parallel (TanStack Query). Date range **only** on reconciliation (`startDate`, `endDate`). Loading / empty (zeros) / error / retry. Manual refresh. Render **only** fields listed in §2.8. Optional link from `recentRuns` to run detail (page can exist as stub until F5).

**APIs:**  
`GET /orgs/:orgId/dashboard/summary`  
`GET /orgs/:orgId/dashboard/reconciliation`  
`GET /orgs/:orgId/dashboard/exceptions`  
`GET /orgs/:orgId/dashboard/activity`

**Depends on:** F2.

**Tests:** mock four payloads; error on one section does not blank the others (isolate queries).

**DoD:** Numbers match API; no hardcoded metrics.

---

### Phase F4 — Transaction management (sources, import, explorer)

**Objective:** Configure sources, import CSV, inspect errors/duplicates, browse transactions.  
**Complexity:** High.

**Features:**

- Data source list/create/edit/deactivate; column mapping form (required four fields + optional). Handle 409 name clash and 409 delete-with-transactions.
- Import wizard: select source → upload `file` → show `{ jobId, importId, duplicateFile }` → poll import status **or** job until COMPLETED/FAILED → show valid/invalid/duplicate counts → paginated errors.
- Import history with filters (`dataSourceId`, `status`).
- Duplicate candidates list (read-only).
- Transaction table: filters matching `QueryTransactionsDto`; always paginate (`limit` ≤ 100). Detail page read-only.
- AUDITOR: no upload control.

**APIs:** data-sources CRUD; import POST/GET/errors/status; duplicate-candidates GET; transactions GET list/detail; jobs GET by id.

**Depends on:** F2 (can proceed in parallel with F3).

**Tests:** FormData field name `file`; 413/400 messages; pagination params; analyst can upload, auditor cannot.

**DoD:** End-to-end import against MinIO-backed API produces transactions in the explorer.

---

### Phase F5 — Reconciliation management

**Objective:** Start pairwise runs and review/act on matches without reimplementing matching.  
**Complexity:** High.

**Features:**

- New run form: source A, source B (must differ), dateFrom/dateTo, optional config defaults (dateWindowDays 2, potentialThreshold 60, exactThreshold 100).
- Double-submit: disable button + `Idempotency-Key`.
- Handle 409 (already processing / idempotent replay).
- Run history + detail counters.
- Tabs/sections: exact matches, potential (PENDING), unmatched; filters `classification`/`status`.
- Display `score` and `reasons` from API (explainability).
- Confirm (no body); reject with optional reason.
- 400/409 on confirm/reject shown to user; refetch lists.
- Poll job/run only if not already COMPLETED (sync backend often returns completed run immediately).

**APIs:** all reconciliation endpoints + `GET /jobs/:id`.

**Depends on:** F4 (need two sources + transactions).

**Tests:** confirm invalidates potential list; auditor cannot POST confirm; unmatched pagination.

**DoD:** Two imported sources can be reconciled and potential matches confirmed/rejected via UI.

**Note:** There is no “saved reconciliation configuration” API. Do not build a config CRUD screen.

---

### Phase F6 — Exception management

**Objective:** Exception list/detail following **backend** FSM.  
**Complexity:** High.

**Features:**

- List with filters from `QueryExceptionsDto`.
- Detail: transaction, run, assignee, comments, resolution fields.
- Assign/reassign: `assigneeId`. **Limitation:** member list is ADMIN-only. Non-admins can still assign **themselves** (`user.id` from `/auth/me`). Assigning others is ADMIN-only unless a backend members-list for managers/analysts is added (see §11).
- Comment create.
- Status buttons enabled from the transition table; disabled ≠ skipped — still handle 409.
- Resolve form: reason + `resolutionAction` enum.
- Reopen from RESOLVED.
- AUDITOR: read-only.

**APIs:** exceptions GET/assign/comments/status.

**Depends on:** F5 (exceptions are created by runs).

**Tests:** resolve without reason blocked client-side and 400 from API; illegal START_REVIEW from RESOLVED shows 409; auditor cannot comment.

**DoD:** Full lifecycle OPEN → ASSIGNED/UNDER_REVIEW → RESOLVE → REOPEN works through the API.

---

### Phase F7 — Audit logs and job monitoring

**Objective:** Inspect audit trail and jobs with polling only when needed.  
**Complexity:** Low–Medium.

**Features:**

- Audit table + filters (`action`, `entityType`, `entityId`, `actorId`, dates). Detail view for one log.
- Jobs table + filters; detail with `progress`, `message`, `error`, `result`, `referenceId` links to import or run.
- Poll job detail iff `QUEUED`/`RUNNING`.
- No WebSockets.

**APIs:** audit list/detail; jobs list/detail.

**Depends on:** F2. Can overlap F3–F6.

**Tests:** pagination `meta`; no polling when COMPLETED.

**DoD:** User can open an exception resolve event in audit and a CSV_IMPORT job in jobs.

---

### Phase F8 — Integration, testing, frontend MVP gate

**Objective:** Prove the product loop on the real API; freeze MVP.  
**Complexity:** High.

**Work:** Playwright (or equivalent) against local API+DB+MinIO; Vitest for client/FSM button matrix; `tsc`, lint, production build; role matrix e2e; console/network failure checks; document known backend gaps.

**Depends on:** F1–F7.

**DoD:** Acceptance criteria in §12 all pass on real backend, or listed as blocked in §11.

---

## 9. Phase dependencies

```text
F0 → F1 → F2 → F3
                ↘
                 F4 → F5 → F6
                ↗
F2 → F7 (parallel with F3–F6)
All → F8
```

- F3 and F4 can proceed in parallel after F2.  
- F5 needs F4 data.  
- F6 needs F5 runs (or seeded exceptions).  
- F7 is independent after F2.  
- Do not start F8 until F1–F7 exist.

---

## 10. Testing strategy

| Layer | What |
|---|---|
| Unit | `api/client` refresh mutex; pagination normalizer; `permissions.ts`; exception **button** matrix (UX only) |
| Component | Forms (login, mapping, resolve) with mocked API |
| Integration | Query invalidation after confirm/import |
| E2E | Register → two sources → two CSVs → run → confirm/reject → exception resolve → dashboard/audit/jobs |
| RBAC e2e | Auditor forbidden on upload/run/confirm/resolve; Admin members page |
| Isolation | User B cannot open `/orgs/{orgA}/...` (expect 404 pages) |
| Quality | `pnpm --filter @reconcilex/web typecheck`, lint, `vite build` |

No mock data in the integrated app after F4. Test fixtures = synthetic CSVs only.

---

## 11. Backend dependencies and missing APIs

These are **not** frontend inventions. Work around them or schedule a small backend patch **outside Milestone B**.

| Gap | Impact | Frontend workaround | Backend fix (optional) |
|---|---|---|---|
| Members list is ADMIN-only | Analysts cannot pick another assignee | Assign-to-self only; ADMIN uses member list | `GET members` for ANALYST/MANAGER (directory, not role change) |
| Duplicate candidates have no dismiss/confirm API | Quarantine is view-only | Read-only list | PATCH status |
| No transaction write APIs | Cannot edit txns in UI | Read-only explorer | None for MVP |
| No saved reconciliation config entity | No config admin screen | Config on create-run form only | None |
| Accept invite does not set cookies / no JwtAuthGuard | Extra login step | After accept, redirect to login | Optional: set cookies on accept |
| Password reset token returned in JSON, no email | Fine for MVP | Reset form using token query/body | Email in Milestone B |
| Invitation token returned in JSON, no email | Admin copies link | Settings page shows `inviteToken` once | Email later |
| Audit not scoped for ANALYST | Broader than PRD | Show full org audit to all roles | Filter later |
| Pagination shapes inconsistent | Client complexity | Normalizer in `api/pagination.ts` | Standardize later |
| Data-sources GET is array **or** page object | Easy to mishandle | Always pass `page` & `limit` | Always paginate |
| CORS `origin: *` + credentials; `Idempotency-Key` not in `allowedHeaders` | Breaks cross-origin cookie/fetch | **Vite proxy (required in F0)** | Set `CORS_ORIGIN` to the web origin; allow `Idempotency-Key` |
| No login rate limit | Abuse | None | Milestone B |
| Jobs `RUNNING` vs runs `PROCESSING` | Wrong poll predicates | Use the correct enum per resource | Document only |
| Sync jobs finish inside HTTP | Progress UI often 100% immediately | Treat terminal create response as done; poll if not | BullMQ in Milestone B |
| Health is under global prefix | Path is `/api/v1/health` | Use that path | None |

**Not blockers for MVP:** reports, PDF, notifications, WebSockets, BullMQ, fuzzy search.

---

## 12. Frontend MVP acceptance criteria

Complete only when a **real** user against the **real** API can:

1. Register or log in (cookies, not localStorage).  
2. Land in their organization (switch if multiple memberships).  
3. See dashboard numbers from `/dashboard/*`.  
4. Create data sources with column mappings.  
5. Upload CSV, see validation errors and imported transactions.  
6. Start a pairwise reconciliation (two sources, date range).  
7. View exact, potential, and unmatched results with scores/reasons.  
8. Confirm and reject potential matches.  
9. Open exceptions created by the run.  
10. Assign (at least self), comment, start review, escalate, resolve (reason + action), reopen.  
11. Browse audit logs for those actions.  
12. Open the related job and see status/progress/error.

AUDITOR can view 3, 7, 9, 11, 12 and cannot perform 5, 6, 8, 10.

If any item fails solely due to §11, record it as a backend blocker rather than faking UI success.

---

## 13. Deferred Milestone B boundaries

Do **not** implement in this frontend wave:

- Redis, BullMQ, worker processes, DLQ, true async progress.  
- Report generation / CSV-PDF export screens.  
- Extra security (rate limits, helmet hardening) as a frontend project.  
- Performance work, CI/CD, OpenTelemetry.  
- WebSockets.  
- Email/Slack notifications.  
- AI/fuzzy matching UI.

The UI may poll job status so it will keep working when workers arrive.

---

## 14. Implementation notes for the next agent

When told “Implement Phase F0”:

1. Create `apps/web` with Vite React TS.  
2. Add workspace scripts; do not rewrite `apps/api`.  
3. Configure proxy and cookie fetch client.  
4. Do not add visual theme libraries.  
5. Do not call `move_agent_to_root` away from this repo; work **in** `reconcile-x`.

When told “Implement Phase Fn”, implement **only** that phase’s DoD, using APIs listed above.

---

## 15. Distinctions recap

| Category | Items |
|---|---|
| **Already implemented (backend)** | Auth cookies, orgs/RBAC, data sources, CSV import+duplicates (flag only), transactions read, pairwise runs, confirm/reject, exception FSM, dashboard, audit, jobs (sync) |
| **Planned (frontend)** | F0–F8 in this document |
| **Missing backend** | Duplicate resolve APIs, non-admin member directory, invite/reset email, cookie-on-accept, CORS headers for non-proxy, analyst-limited audit |
| **Recommendations pending confirmation** | Vite+React+TanStack Query+Zod; styling postponed; Vite proxy as cookie strategy |
