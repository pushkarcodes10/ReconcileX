import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, PoolConfig } from 'pg';
import * as schema from './schema';

export type DatabaseClient = NodePgDatabase<typeof schema>;
export type DatabasePool = Pool;

export interface DatabaseHealthResult {
  isHealthy: boolean;
  latencyMs: number;
  timestamp: string;
}

export interface DatabaseConnectionOptions {
  connectionString?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

/**
 * Creates a PostgreSQL connection pool and wraps it with Drizzle ORM.
 */
export function createDatabaseClient(options: DatabaseConnectionOptions): {
  db: DatabaseClient;
  pool: DatabasePool;
} {
  const poolConfig: PoolConfig = options.connectionString
    ? {
        connectionString: options.connectionString,
        connectionTimeoutMillis: options.connectionTimeoutMillis ?? 5000,
      }
    : {
        host: options.host,
        port: options.port,
        user: options.user,
        password: options.password,
        database: options.database,
        max: options.max ?? 10,
        idleTimeoutMillis: options.idleTimeoutMillis ?? 30000,
        connectionTimeoutMillis: options.connectionTimeoutMillis ?? 5000,
      };

  const pool = new Pool(poolConfig);
  const db = drizzle(pool, { schema });

  return { db, pool };
}

/**
 * Verifies live PostgreSQL connectivity by executing a lightweight SELECT 1 query.
 */
export async function checkDatabaseHealth(pool: DatabasePool): Promise<DatabaseHealthResult> {
  const start = Date.now();
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    const latencyMs = Date.now() - start;
    return {
      isHealthy: true,
      latencyMs,
      timestamp: new Date().toISOString(),
    };
  } finally {
    client.release();
  }
}

/**
 * Gracefully terminates the PostgreSQL connection pool.
 */
export async function closeDatabaseClient(pool: DatabasePool): Promise<void> {
  await pool.end();
}

/**
 * Initializes schema DDL idempotently on startup if tables do not exist.
 */
export async function initializeSchema(pool: DatabasePool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      CREATE TABLE IF NOT EXISTS organizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS organization_memberships (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS org_membership_user_org_idx ON organization_memberships(user_id, organization_id);

      CREATE TABLE IF NOT EXISTS invitations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        token_hash VARCHAR(64) NOT NULL UNIQUE,
        invited_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        accepted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(64) NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS password_resets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(64) NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS data_sources (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        direction VARCHAR(50) NOT NULL DEFAULT 'INCOMING',
        column_mapping JSONB NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,
        CONSTRAINT data_sources_org_id_uniq UNIQUE(organization_id, id)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS data_sources_org_name_idx ON data_sources(organization_id, name) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS data_sources_org_status_idx ON data_sources(organization_id, status);
      CREATE INDEX IF NOT EXISTS data_sources_org_idx ON data_sources(organization_id);

      CREATE TABLE IF NOT EXISTS imports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE RESTRICT,
        storage_key VARCHAR(512) NOT NULL,
        original_filename VARCHAR(255) NOT NULL,
        content_sha256 VARCHAR(64) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'QUEUED',
        row_count INTEGER NOT NULL DEFAULT 0,
        valid_count INTEGER NOT NULL DEFAULT 0,
        invalid_count INTEGER NOT NULL DEFAULT 0,
        duplicate_count INTEGER NOT NULL DEFAULT 0,
        error_summary JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        CONSTRAINT imports_org_datasource_fk FOREIGN KEY (organization_id, data_source_id) REFERENCES data_sources(organization_id, id) ON DELETE RESTRICT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS imports_org_source_sha256_idx ON imports(organization_id, data_source_id, content_sha256);
      CREATE INDEX IF NOT EXISTS imports_org_source_idx ON imports(organization_id, data_source_id);
      CREATE INDEX IF NOT EXISTS imports_org_status_idx ON imports(organization_id, status);
      CREATE INDEX IF NOT EXISTS imports_org_created_idx ON imports(organization_id, created_at);

      CREATE TABLE IF NOT EXISTS import_row_errors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        import_id UUID NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
        row_number INTEGER NOT NULL,
        field VARCHAR(100),
        code VARCHAR(100) NOT NULL,
        raw_value TEXT,
        message TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS import_row_errors_org_import_idx ON import_row_errors(organization_id, import_id);
      CREATE INDEX IF NOT EXISTS import_row_errors_import_row_idx ON import_row_errors(import_id, row_number);

      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE RESTRICT,
        import_id UUID REFERENCES imports(id) ON DELETE SET NULL,
        external_id VARCHAR(255) NOT NULL,
        amount_minor BIGINT NOT NULL,
        currency VARCHAR(3) NOT NULL,
        transaction_date TIMESTAMPTZ NOT NULL,
        reference VARCHAR(255),
        external_txn_id VARCHAR(255),
        merchant_or_order_id VARCHAR(255),
        txn_type VARCHAR(50),
        status VARCHAR(50) NOT NULL DEFAULT 'UNMATCHED',
        normalized_payload JSONB,
        fingerprint VARCHAR(64),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT transactions_org_datasource_fk FOREIGN KEY (organization_id, data_source_id) REFERENCES data_sources(organization_id, id) ON DELETE RESTRICT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS transactions_org_source_ext_id_idx ON transactions(organization_id, data_source_id, external_id);
      CREATE INDEX IF NOT EXISTS transactions_org_date_idx ON transactions(organization_id, transaction_date);
      CREATE INDEX IF NOT EXISTS transactions_org_status_idx ON transactions(organization_id, status);
      CREATE INDEX IF NOT EXISTS transactions_org_reference_idx ON transactions(organization_id, reference);
      CREATE INDEX IF NOT EXISTS transactions_org_source_idx ON transactions(organization_id, data_source_id);
      CREATE INDEX IF NOT EXISTS transactions_org_import_idx ON transactions(organization_id, import_id);

      CREATE TABLE IF NOT EXISTS duplicate_candidates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        import_id UUID NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
        data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE RESTRICT,
        existing_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
        candidate_fingerprint VARCHAR(64),
        external_id VARCHAR(255) NOT NULL,
        row_number INTEGER,
        reason VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'FLAGGED',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS duplicate_candidates_org_import_idx ON duplicate_candidates(organization_id, import_id);
      CREATE INDEX IF NOT EXISTS duplicate_candidates_org_status_idx ON duplicate_candidates(organization_id, status);
      CREATE INDEX IF NOT EXISTS duplicate_candidates_org_source_idx ON duplicate_candidates(organization_id, data_source_id);

      CREATE TABLE IF NOT EXISTS reconciliation_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        display_id VARCHAR(50) NOT NULL,
        source_a_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE RESTRICT,
        source_b_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE RESTRICT,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        config JSONB NOT NULL,
        total_source_a INTEGER NOT NULL DEFAULT 0,
        total_source_b INTEGER NOT NULL DEFAULT 0,
        exact_match_count INTEGER NOT NULL DEFAULT 0,
        potential_match_count INTEGER NOT NULL DEFAULT 0,
        unmatched_count INTEGER NOT NULL DEFAULT 0,
        idempotency_key VARCHAR(255),
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT reconciliation_runs_org_source_a_fk FOREIGN KEY (organization_id, source_a_id) REFERENCES data_sources(organization_id, id) ON DELETE RESTRICT,
        CONSTRAINT reconciliation_runs_org_source_b_fk FOREIGN KEY (organization_id, source_b_id) REFERENCES data_sources(organization_id, id) ON DELETE RESTRICT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS reconciliation_runs_org_display_id_idx ON reconciliation_runs(organization_id, display_id);
      CREATE INDEX IF NOT EXISTS reconciliation_runs_org_status_idx ON reconciliation_runs(organization_id, status);
      CREATE INDEX IF NOT EXISTS reconciliation_runs_org_created_idx ON reconciliation_runs(organization_id, created_at);
      CREATE INDEX IF NOT EXISTS reconciliation_runs_org_idempotency_idx ON reconciliation_runs(organization_id, idempotency_key);

      CREATE TABLE IF NOT EXISTS matches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        run_id UUID NOT NULL REFERENCES reconciliation_runs(id) ON DELETE CASCADE,
        transaction_a_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
        transaction_b_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
        classification VARCHAR(50) NOT NULL,
        score INTEGER NOT NULL,
        reasons JSONB NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        confirmed_at TIMESTAMPTZ,
        rejected_by UUID REFERENCES users(id) ON DELETE SET NULL,
        rejected_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS matches_run_txna_txnb_idx ON matches(run_id, transaction_a_id, transaction_b_id);
      CREATE UNIQUE INDEX IF NOT EXISTS matches_run_txn_a_active_idx ON matches(run_id, transaction_a_id) WHERE status != 'REJECTED';
      CREATE UNIQUE INDEX IF NOT EXISTS matches_run_txn_b_active_idx ON matches(run_id, transaction_b_id) WHERE status != 'REJECTED';
      CREATE INDEX IF NOT EXISTS matches_org_run_idx ON matches(organization_id, run_id);
      CREATE INDEX IF NOT EXISTS matches_org_status_idx ON matches(organization_id, status);
      CREATE INDEX IF NOT EXISTS matches_org_classification_idx ON matches(organization_id, classification);

      CREATE TABLE IF NOT EXISTS exceptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        run_id UUID NOT NULL REFERENCES reconciliation_runs(id) ON DELETE CASCADE,
        transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
        status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
        assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
        resolution_reason TEXT,
        resolution_action VARCHAR(100),
        resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
        resolved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS exceptions_org_status_idx ON exceptions(organization_id, status);
      CREATE INDEX IF NOT EXISTS exceptions_org_run_idx ON exceptions(organization_id, run_id);
      CREATE INDEX IF NOT EXISTS exceptions_org_assignee_idx ON exceptions(organization_id, assignee_id);
      CREATE INDEX IF NOT EXISTS exceptions_org_created_idx ON exceptions(organization_id, created_at);
      CREATE INDEX IF NOT EXISTS exceptions_run_txn_idx ON exceptions(run_id, transaction_id);
      CREATE UNIQUE INDEX IF NOT EXISTS exceptions_run_txn_open_idx ON exceptions(run_id, transaction_id) WHERE transaction_id IS NOT NULL AND status != 'RESOLVED';

      CREATE TABLE IF NOT EXISTS exception_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        exception_id UUID NOT NULL REFERENCES exceptions(id) ON DELETE CASCADE,
        author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS exception_comments_exception_created_idx ON exception_comments(exception_id, created_at);
      CREATE INDEX IF NOT EXISTS exception_comments_org_created_idx ON exception_comments(organization_id, created_at);
    `);
  } finally {
    client.release();
  }
}

export * from './schema';
export { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from 'drizzle-orm';
