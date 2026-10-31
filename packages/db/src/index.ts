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

      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE RESTRICT,
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
    `);
  } finally {
    client.release();
  }
}

export * from './schema';
export { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from 'drizzle-orm';
