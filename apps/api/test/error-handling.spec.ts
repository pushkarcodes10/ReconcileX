import {
  BadRequestException,
  Controller,
  Get,
  HttpStatus,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { RequestIdMiddleware } from '../src/common/middleware/request-id.middleware';

@Controller('test-errors')
class TestErrorController {
  @Get('bad-request')
  throwBadRequest(): void {
    throw new BadRequestException('Invalid input parameter provided');
  }

  @Get('not-found')
  throwNotFound(): void {
    throw new NotFoundException('Requested resource does not exist');
  }

  @Get('unexpected')
  throwUnexpected(): void {
    throw new Error(
      'CRITICAL_DATABASE_ERROR: relation "secret_users" password="super_secret_db_pass" failed at /app/core.ts:123',
    );
  }
}

describe('Global Error Handling', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TestErrorController],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(new RequestIdMiddleware().use);
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should format known HTTP exceptions into the standard error envelope', async () => {
    const customRequestId = 'test-req-bad-request-1';

    const response = await request(app.getHttpServer())
      .get('/test-errors/bad-request')
      .set('X-Request-Id', customRequestId)
      .expect(HttpStatus.BAD_REQUEST);

    expect(response.body).toEqual({
      error: {
        code: 'BAD_REQUEST',
        message: 'Invalid input parameter provided',
        details: null,
        requestId: customRequestId,
      },
    });
    expect(response.headers['x-request-id']).toBe(customRequestId);
  });

  it('should handle 404 NotFoundException with proper code and message', async () => {
    const response = await request(app.getHttpServer())
      .get('/test-errors/not-found')
      .expect(HttpStatus.NOT_FOUND);

    expect(response.body.error).toBeDefined();
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.error.message).toBe('Requested resource does not exist');
    expect(response.body.error.requestId).toBeDefined();
  });

  it('should sanitize unhandled 500 exceptions and NEVER expose stack traces or DB internals', async () => {
    const customRequestId = 'test-req-unhandled-500';

    const response = await request(app.getHttpServer())
      .get('/test-errors/unexpected')
      .set('X-Request-Id', customRequestId)
      .expect(HttpStatus.INTERNAL_SERVER_ERROR);

    expect(response.body).toEqual({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        details: null,
        requestId: customRequestId,
      },
    });

    const rawBody = JSON.stringify(response.body);

    // Strict security assertions: no stack trace, no internal DB identifiers
    expect(rawBody).not.toContain('stack');
    expect(rawBody).not.toContain('CRITICAL_DATABASE_ERROR');
    expect(rawBody).not.toContain('super_secret_db_pass');
    expect(rawBody).not.toContain('secret_users');
    expect(rawBody).not.toContain('/app/core.ts');
  });
});
