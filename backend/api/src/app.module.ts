import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { LoggerModule } from 'nestjs-pino';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import configuration from './config/configuration';
import { validateEnvironment } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { DataSourcesModule } from './modules/data-sources/data-sources.module';
import { ImportsModule } from './modules/imports/imports.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { StorageModule } from './modules/storage/storage.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { ReconciliationModule } from './modules/reconciliation/reconciliation.module';
import { ExceptionsModule } from './modules/exceptions/exceptions.module';
import { AuditModule } from './modules/audit/audit.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ScreenshotModule } from './modules/screenshot/screenshot.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env', '../.env'],
      load: [configuration],
      validate: validateEnvironment,
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isDev = configService.get<string>('app.nodeEnv') !== 'production';
        const logLevel = configService.get<string>('app.logging.level') || 'info';

        return {
          pinoHttp: {
            level: logLevel,
            customProps: (req) => ({
              requestId: (req as Request).id,
            }),
            genReqId: (req) => (req as Request).id || (req.headers['x-request-id'] as string),
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.headers["x-api-key"]',
                'req.body.password',
                'req.body.token',
                'req.body.secret',
                'req.body.credentials',
              ],
              censor: '[REDACTED]',
            },
            transport: isDev
              ? {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    singleLine: true,
                    translateTime: 'yyyy-mm-dd HH:MM:ss.l',
                  },
                }
              : undefined,
          },
        };
      },
    }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    OrganizationsModule,
    DataSourcesModule,
    TransactionsModule,
    StorageModule,
    ImportsModule,
    ReconciliationModule,
    ExceptionsModule,
    AuditModule,
    JobsModule,
    DashboardModule,
    ScreenshotModule,
  ],
  providers: [
    {
      provide: 'APP_FILTER',
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
