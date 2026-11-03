import { Inject, Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import {
  checkDatabaseHealth,
  closeDatabaseClient,
  DatabaseClient,
  DatabaseHealthResult,
  DatabasePool,
  initializeSchema,
} from '@reconcilex/db';
import { DATABASE_CLIENT, DATABASE_POOL } from './database.constants';

@Injectable()
export class DatabaseService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(
    @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
    @Inject(DATABASE_POOL) private readonly pool: DatabasePool,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await initializeSchema(this.pool);
      this.logger.log('Database schema verified and initialized.');
    } catch (error) {
      this.logger.warn(
        `Failed to auto-verify schema on startup: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  getClient(): DatabaseClient {
    return this.db;
  }

  getPool(): DatabasePool {
    return this.pool;
  }

  async checkHealth(): Promise<DatabaseHealthResult> {
    return checkDatabaseHealth(this.pool);
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`Closing database pool on shutdown (signal: ${signal})...`);
    await closeDatabaseClient(this.pool);
    this.logger.log('Database pool closed successfully.');
  }
}
