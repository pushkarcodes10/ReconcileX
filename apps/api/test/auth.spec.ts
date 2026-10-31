import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { RequestIdMiddleware } from '../src/common/middleware/request-id.middleware';
import configuration from '../src/config/configuration';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { PasswordService } from '../src/modules/auth/password.service';
import { AUTH_REPOSITORY } from '../src/modules/auth/repositories/auth.repository.interface';
import { InMemoryAuthRepository } from '../src/modules/auth/repositories/in-memory-auth.repository';
import { TokenService } from '../src/modules/auth/token.service';

describe('Auth Endpoints (Phase A2)', () => {
  let app: INestApplication;
  let authRepo: InMemoryAuthRepository;

  beforeAll(async () => {
    authRepo = new InMemoryAuthRepository();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configuration],
        }),
        JwtModule.register({}),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        PasswordService,
        TokenService,
        JwtAuthGuard,
        {
          provide: AUTH_REPOSITORY,
          useValue: authRepo,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.use(new RequestIdMiddleware().use);
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();
  });

  beforeEach(() => {
    authRepo.clear();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user, organization, and ADMIN membership, and set cookies', async () => {
      const payload = {
        name: 'Jane Doe',
        email: 'jane@reconcilex.test',
        password: 'Password123!',
        orgName: 'Acme Payments',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(payload)
        .expect(HttpStatus.CREATED);

      expect(response.body.user).toEqual({
        id: expect.any(String),
        email: 'jane@reconcilex.test',
        name: 'Jane Doe',
      });
      expect(response.body.organization).toEqual({
        id: expect.any(String),
        name: 'Acme Payments',
        slug: expect.stringContaining('acme-payments'),
        role: 'ADMIN',
      });

      // Verify httpOnly cookies are set
      const cookies = response.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();
      expect(cookies.some((c) => c.startsWith('access_token='))).toBe(true);
      expect(cookies.some((c) => c.startsWith('refresh_token='))).toBe(true);
      expect(cookies.some((c) => c.includes('HttpOnly'))).toBe(true);
    });

    it('should return 409 Conflict if email is already registered', async () => {
      const payload = {
        name: 'Jane Doe',
        email: 'duplicate@reconcilex.test',
        password: 'Password123!',
        orgName: 'Acme Payments',
      };

      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(payload)
        .expect(HttpStatus.CREATED);

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(payload)
        .expect(HttpStatus.CONFLICT);

      expect(response.body.error.code).toBe('CONFLICT');
      expect(response.body.error.message).toContain('already exists');
    });

    it('should reject registration with weak password (< 8 chars)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          name: 'Weak Pass',
          email: 'weak@reconcilex.test',
          password: '123',
          orgName: 'Weak Org',
        })
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.error.code).toBe('BAD_REQUEST');
      expect(response.body.error.details).toBeDefined();
    });

    it('should reject registration with invalid email format', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          name: 'Invalid Email',
          email: 'not-an-email',
          password: 'Password123!',
          orgName: 'Org',
        })
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        name: 'Existing User',
        email: 'login@reconcilex.test',
        password: 'CorrectPassword123',
        orgName: 'Fintech Corp',
      });
    });

    it('should authenticate successfully with correct credentials and set cookies', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'login@reconcilex.test',
          password: 'CorrectPassword123',
        })
        .expect(HttpStatus.OK);

      expect(response.body.user.email).toBe('login@reconcilex.test');
      expect(response.body.memberships).toHaveLength(1);
      expect(response.body.memberships[0].role).toBe('ADMIN');

      const cookies = response.headers['set-cookie'] as unknown as string[];
      expect(cookies.some((c) => c.startsWith('access_token='))).toBe(true);
      expect(cookies.some((c) => c.startsWith('refresh_token='))).toBe(true);
    });

    it('should return 401 Unauthorized on wrong password', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'login@reconcilex.test',
          password: 'WrongPassword!',
        })
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body.error.code).toBe('UNAUTHORIZED');
      expect(response.body.error.message).toBe('Invalid email or password');
    });

    it('should return 401 Unauthorized on unknown email without leaking existence', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'unknown@reconcilex.test',
          password: 'AnyPassword123',
        })
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body.error.code).toBe('UNAUTHORIZED');
      expect(response.body.error.message).toBe('Invalid email or password');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return 401 if unauthenticated', async () => {
      await request(app.getHttpServer()).get('/api/v1/auth/me').expect(HttpStatus.UNAUTHORIZED);
    });

    it('should return user profile and memberships when session cookie is provided', async () => {
      const reg = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        name: 'Session User',
        email: 'session@reconcilex.test',
        password: 'Password123!',
        orgName: 'Session Org',
      });

      const cookies = reg.headers['set-cookie'] as unknown as string[];

      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Cookie', cookies)
        .expect(HttpStatus.OK);

      expect(response.body.user.email).toBe('session@reconcilex.test');
      expect(response.body.memberships).toHaveLength(1);
      expect(response.body.memberships[0].orgName).toBe('Session Org');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should rotate the refresh token and set new cookies', async () => {
      const reg = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        name: 'Refresh User',
        email: 'refresh@reconcilex.test',
        password: 'Password123!',
        orgName: 'Refresh Org',
      });

      const initialCookies = reg.headers['set-cookie'] as unknown as string[];
      const refreshTokenCookie = initialCookies.find((c) => c.startsWith('refresh_token='));

      const refreshResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', [refreshTokenCookie!])
        .expect(HttpStatus.OK);

      expect(refreshResponse.body).toEqual({ success: true });

      const newCookies = refreshResponse.headers['set-cookie'] as unknown as string[];
      expect(newCookies.some((c) => c.startsWith('access_token='))).toBe(true);
      expect(newCookies.some((c) => c.startsWith('refresh_token='))).toBe(true);

      // Verify the old refresh token can no longer be used (revoked)
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', [refreshTokenCookie!])
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should revoke the refresh token and clear cookies', async () => {
      const reg = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        name: 'Logout User',
        email: 'logout@reconcilex.test',
        password: 'Password123!',
        orgName: 'Logout Org',
      });

      const cookies = reg.headers['set-cookie'] as unknown as string[];

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Cookie', cookies)
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);

      // Verify cookies are expired / cleared
      const setCookies = response.headers['set-cookie'] as unknown as string[];
      expect(setCookies.some((c) => c.includes('access_token=;'))).toBe(true);
      expect(setCookies.some((c) => c.includes('refresh_token=;'))).toBe(true);
    });
  });

  describe('Password Reset Lifecycle', () => {
    it('should always return 202 on password reset request', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/password-reset/request')
        .send({ email: 'nonexistent@reconcilex.test' })
        .expect(HttpStatus.ACCEPTED);

      expect(response.body.message).toContain('password reset instructions');
    });

    it('should reset password with valid token and allow login with new password', async () => {
      await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        name: 'Reset Test',
        email: 'reset@reconcilex.test',
        password: 'OldPassword123',
        orgName: 'Reset Org',
      });

      const requestResp = await request(app.getHttpServer())
        .post('/api/v1/auth/password-reset/request')
        .send({ email: 'reset@reconcilex.test' })
        .expect(HttpStatus.ACCEPTED);

      const resetToken = requestResp.body.resetToken as string;
      expect(resetToken).toBeDefined();

      // Confirm reset
      await request(app.getHttpServer())
        .post('/api/v1/auth/password-reset/confirm')
        .send({
          token: resetToken,
          newPassword: 'BrandNewPassword999!',
        })
        .expect(HttpStatus.OK);

      // Old password should now fail
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'reset@reconcilex.test',
          password: 'OldPassword123',
        })
        .expect(HttpStatus.UNAUTHORIZED);

      // New password should succeed
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'reset@reconcilex.test',
          password: 'BrandNewPassword999!',
        })
        .expect(HttpStatus.OK);
    });
  });
});
