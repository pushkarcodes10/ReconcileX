import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';
import { HealthService } from '../src/health/health.service';

describe('Application Bootstrap', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    // Override DatabaseService health check during bootstrap test so tests can run in headless/CI environments
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DatabaseService)
      .useValue({
        checkHealth: async () => ({
          isHealthy: true,
          latencyMs: 1,
          timestamp: new Date().toISOString(),
        }),
        onApplicationShutdown: async () => {},
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should compile and initialize all core providers', () => {
    expect(app).toBeDefined();

    const configService = moduleRef.get(ConfigService);
    expect(configService).toBeDefined();
    expect(configService.get('app.apiPrefix')).toBe('api/v1');

    const healthService = moduleRef.get(HealthService);
    expect(healthService).toBeDefined();
  });
});
