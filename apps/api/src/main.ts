import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Use Pino structured logger for all NestJS internal and application logs
  const logger = app.get(Logger);
  app.useLogger(logger);

  // Cookie parser for reading httpOnly JWT and refresh cookies
  app.use(cookieParser());

  // Retrieve application configuration
  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') || 3000;
  const apiPrefix = configService.get<string>('app.apiPrefix') || 'api/v1';
  const corsConfig = configService.get<AppConfig['cors']>('app.cors');

  // Enable CORS
  app.enableCors({
    origin: corsConfig?.origin || '*',
    credentials: corsConfig?.credentials ?? true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
  });

  // Global API Prefix
  app.setGlobalPrefix(apiPrefix, {
    exclude: ['api/docs', 'api/docs/(.*)'],
  });

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Graceful shutdown hooks
  app.enableShutdownHooks();

  // Swagger / OpenAPI documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('ReconcileX API')
    .setDescription(
      'ReconcileX — Production-Grade Transaction Reconciliation Platform API Documentation',
    )
    .setVersion('1.0')
    .addTag('Health', 'Application liveness and readiness probes')
    .addTag('Auth', 'Authentication and session management')
    .addTag('Organizations', 'Multi-tenant organization and membership management')
    .addTag('Data Sources', 'Data source configuration and canonical column mapping')
    .addTag('Transactions', 'Canonical transaction catalog and exploration')
    .addTag(
      'Duplicate Candidates',
      'Flagged duplicate transaction candidates for quarantine inspection',
    )
    .addCookieAuth('access_token', {
      type: 'apiKey',
      in: 'cookie',
      name: 'access_token',
      description: 'JWT session cookie',
    })
    .addApiKey({ type: 'apiKey', name: 'X-Organization-Id', in: 'header' }, 'X-Organization-Id')
    .addApiKey({ type: 'apiKey', name: 'X-Request-Id', in: 'header' }, 'X-Request-Id')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'ReconcileX API Docs',
  });

  await app.listen(port);
  logger.log(`ReconcileX API is running on: http://localhost:${port}/${apiPrefix}`);
  logger.log(`Swagger documentation available at: http://localhost:${port}/api/docs`);
}

void bootstrap();
