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

export * from './schema';
