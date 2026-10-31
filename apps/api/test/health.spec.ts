import { HttpStatus, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { RequestIdMiddleware } from '../src/common/middleware/request-id.middleware';
import { DatabaseService } from '../src/database/database.service';
import { HealthController } from '../src/health/health.controller';
import { HealthService } from '../src/health/health.service';

describe('Health Endpoints', () => {
  let app: INestApplication;
  let mockDatabaseService: { checkHealth: ReturnType<typeof vi.fn> };

  beforeAll(async () => {
    mockDatabaseService = {
      checkHealth: vi.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(new RequestIdMiddleware().use);
    app.useGlobalFilters(new GlobalExceptionFilter());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/health (Liveness)', () => {
    it('should return 200 with application health status and uptime', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(HttpStatus.OK);

      expect(response.body).toEqual({
        status: 'ok',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
      });
      expect(response.headers['x-request-id']).toBeDefined();
    });
  });

  describe('GET /api/v1/health/ready (Readiness)', () => {
    it('should return 200 when database connectivity is healthy', async () => {
      mockDatabaseService.checkHealth.mockResolvedValueOnce({
        isHealthy: true,
        latencyMs: 3,
        timestamp: new Date().toISOString(),
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .expect(HttpStatus.OK);

      expect(response.body).toEqual({
        status: 'ok',
        timestamp: expect.any(String),
        checks: {
          database: {
            status: 'up',
            latencyMs: 3,
          },
        },
      });
    });

    it('should return 503 when database connectivity is unavailable', async () => {
      mockDatabaseService.checkHealth.mockRejectedValueOnce(
        new Error('Connection refused: postgres://secret_user:secret_pass@db:5432'),
      );

      const response = await request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .expect(HttpStatus.SERVICE_UNAVAILABLE);

      expect(response.body).toEqual({
        status: 'error',
        timestamp: expect.any(String),
        checks: {
          database: {
            status: 'down',
          },
        },
      });

      // Assert credentials or internal connection details are NOT leaked
      const rawBody = JSON.stringify(response.body);
      expect(rawBody).not.toContain('secret_user');
      expect(rawBody).not.toContain('secret_pass');
      expect(rawBody).not.toContain('Connection refused');
    });
  });
});
