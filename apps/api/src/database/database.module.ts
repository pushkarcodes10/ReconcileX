import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDatabaseClient } from '@reconcilex/db';
import { AppConfig } from '../config/configuration';
import { DATABASE_CLIENT, DATABASE_POOL } from './database.constants';
import { DatabaseService } from './database.service';

@Global()
@Module({
  providers: [
    {
      provide: 'DATABASE_SETUP',
      useFactory: (configService: ConfigService) => {
        const dbConfig = configService.get<AppConfig['database']>('app.database');
        return createDatabaseClient({
          connectionString: dbConfig?.url,
          host: dbConfig?.host,
          port: dbConfig?.port,
          user: dbConfig?.user,
          password: dbConfig?.password,
          database: dbConfig?.database,
        });
      },
      inject: [ConfigService],
    },
    {
      provide: DATABASE_CLIENT,
      useFactory: (setup: ReturnType<typeof createDatabaseClient>) => setup.db,
      inject: ['DATABASE_SETUP'],
    },
    {
      provide: DATABASE_POOL,
      useFactory: (setup: ReturnType<typeof createDatabaseClient>) => setup.pool,
      inject: ['DATABASE_SETUP'],
    },
    DatabaseService,
  ],
  exports: [DATABASE_CLIENT, DATABASE_POOL, DatabaseService],
})
export class DatabaseModule {}
