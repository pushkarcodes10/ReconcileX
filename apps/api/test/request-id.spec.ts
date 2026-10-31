import { Controller, Get, HttpStatus, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RequestIdMiddleware } from '../src/common/middleware/request-id.middleware';

@Controller('test-request-id')
class TestController {
  @Get()
  getOk(): { message: string } {
    return { message: 'pong' };
  }
}

describe('Request ID Tracking', () => {
  let app: INestApplication;
  const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TestController],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(new RequestIdMiddleware().use);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should generate a valid UUID v4 when no request ID is provided', async () => {
    const response = await request(app.getHttpServer())
      .get('/test-request-id')
      .expect(HttpStatus.OK);

    const requestIdHeader = response.headers['x-request-id'];
    expect(requestIdHeader).toBeDefined();
    expect(requestIdHeader).toMatch(UUID_V4_REGEX);
  });

  it('should accept and propagate an incoming valid request ID in the response header', async () => {
    const clientTraceId = 'client-custom-trace-uuid-123456';

    const response = await request(app.getHttpServer())
      .get('/test-request-id')
      .set('X-Request-Id', clientTraceId)
      .expect(HttpStatus.OK);

    expect(response.headers['x-request-id']).toBe(clientTraceId);
  });
});
