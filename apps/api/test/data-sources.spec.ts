import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSourceType, Role } from '@reconcilex/db';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { OrgGuard } from '../src/common/guards/org.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { RequestIdMiddleware } from '../src/common/middleware/request-id.middleware';
import configuration from '../src/config/configuration';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { PasswordService } from '../src/modules/auth/password.service';
import { AUTH_REPOSITORY } from '../src/modules/auth/repositories/auth.repository.interface';
import { InMemoryAuthRepository } from '../src/modules/auth/repositories/in-memory-auth.repository';
import { TokenService } from '../src/modules/auth/token.service';
import { DataSourcesController } from '../src/modules/data-sources/data-sources.controller';
import { DataSourcesService } from '../src/modules/data-sources/data-sources.service';
import { DATA_SOURCES_REPOSITORY } from '../src/modules/data-sources/repositories/data-sources.repository.interface';
import { InMemoryDataSourcesRepository } from '../src/modules/data-sources/repositories/in-memory-data-sources.repository';
import { OrganizationsService } from '../src/modules/organizations/organizations.service';
import { InMemoryOrganizationsRepository } from '../src/modules/organizations/repositories/in-memory-organizations.repository';
import { ORGANIZATIONS_REPOSITORY } from '../src/modules/organizations/repositories/organizations.repository.interface';

describe('Data Sources Module (Phase A3)', () => {
  let app: INestApplication;
  let authRepo: InMemoryAuthRepository;
  let orgRepo: InMemoryOrganizationsRepository;
  let dsRepo: InMemoryDataSourcesRepository;

  beforeAll(async () => {
    authRepo = new InMemoryAuthRepository();
    orgRepo = new InMemoryOrganizationsRepository();
    dsRepo = new InMemoryDataSourcesRepository();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configuration],
        }),
        JwtModule.register({}),
      ],
      controllers: [AuthController, DataSourcesController],
      providers: [
        AuthService,
        PasswordService,
        TokenService,
        JwtAuthGuard,
        OrganizationsService,
        DataSourcesService,
        OrgGuard,
        RolesGuard,
        {
          provide: AUTH_REPOSITORY,
          useValue: authRepo,
        },
        {
          provide: ORGANIZATIONS_REPOSITORY,
          useValue: orgRepo,
        },
        {
          provide: DATA_SOURCES_REPOSITORY,
          useValue: dsRepo,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.use(new RequestIdMiddleware().use);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    authRepo.users = [];
    authRepo.organizations = [];
    authRepo.memberships = [];
    authRepo.refreshTokens = [];
    authRepo.invitations = [];
    orgRepo.organizations = authRepo.organizations;
    orgRepo.memberships = authRepo.memberships;
    orgRepo.users = authRepo.users;
    orgRepo.invitations = authRepo.invitations;
    dsRepo.dataSources = [];
    dsRepo.transactionsCountMap.clear();
  });

  const registerUser = async (
    email: string,
    orgName: string,
    name: string = 'Test User',
  ) => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: 'Password123!',
        name,
        organizationName: orgName,
      });

    return {
      body: res.body,
      cookie: res.headers['set-cookie'],
    };
  };

  const sampleMapping = {
    externalId: 'Order ID',
    amount: 'Gross Amount',
    transactionDate: 'Timestamp',
    currency: 'Currency',
    reference: 'Invoice Ref',
  };

  describe('Data Source Creation & Validation', () => {
    it('should allow an ADMIN to create a valid data source', async () => {
      const { body, cookie } = await registerUser('admin@corp.com', 'Acme Corp');
      const orgId = body.organization.id;

      const res = await request(app.getHttpServer())
        .post(`/organizations/${orgId}/data-sources`)
        .set('Cookie', cookie)
        .send({
          name: 'Shopify Store',
          type: DataSourceType.INTERNAL_ORDERS,
          columnMapping: sampleMapping,
        });

      expect(res.status).toBe(HttpStatus.CREATED);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('Shopify Store');
      expect(res.body.type).toBe('INTERNAL_ORDERS');
      expect(res.body.columnMapping.externalId).toBe('Order ID');
      expect(res.body.status).toBe('ACTIVE');
    });

    it('should reject data source with duplicate name in same organization', async () => {
      const { body, cookie } = await registerUser('admin@corp.com', 'Acme Corp');
      const orgId = body.organization.id;

      await request(app.getHttpServer())
        .post(`/organizations/${orgId}/data-sources`)
        .set('Cookie', cookie)
        .send({
          name: 'Stripe Gateway',
          type: DataSourceType.PAYMENT_GATEWAY,
          columnMapping: sampleMapping,
        });

      const res = await request(app.getHttpServer())
        .post(`/organizations/${orgId}/data-sources`)
        .set('Cookie', cookie)
        .send({
          name: 'Stripe Gateway',
          type: DataSourceType.PAYMENT_GATEWAY,
          columnMapping: sampleMapping,
        });

      expect(res.status).toBe(HttpStatus.CONFLICT);
      expect(res.body.message).toContain('already exists');
    });

    it('should reject column mapping missing mandatory fields', async () => {
      const { body, cookie } = await registerUser('admin@corp.com', 'Acme Corp');
      const orgId = body.organization.id;

      const res = await request(app.getHttpServer())
        .post(`/organizations/${orgId}/data-sources`)
        .set('Cookie', cookie)
        .send({
          name: 'Invalid Source',
          type: DataSourceType.BANK,
          columnMapping: {
            externalId: 'ID',
            // Missing amount and transactionDate
          },
        });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe('Role-Based Access Control on Data Sources', () => {
    it('should forbid an ANALYST from creating a data source (403 Forbidden)', async () => {
      const admin = await registerUser('admin@corp.com', 'Acme Corp');
      const orgId = admin.body.organization.id;

      // Add Analyst member directly
      const analystUser = await authRepo.createUser({
        email: 'analyst@corp.com',
        name: 'Analyst Bob',
        passwordHash: 'hash',
        status: 'ACTIVE',
      });
      await authRepo.createMembership(analystUser.id, orgId, Role.ANALYST);

      // Login analyst
      const tokenService = app.get(TokenService);
      const token = await tokenService.generateAccessToken({
        sub: analystUser.id,
        email: analystUser.email,
      });

      const res = await request(app.getHttpServer())
        .post(`/organizations/${orgId}/data-sources`)
        .set('Cookie', [`access_token=${token}`])
        .send({
          name: 'Unauthorized Source',
          type: DataSourceType.BANK,
          columnMapping: sampleMapping,
        });

      expect(res.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('should allow an ANALYST or AUDITOR to read data sources (200 OK)', async () => {
      const admin = await registerUser('admin@corp.com', 'Acme Corp');
      const orgId = admin.body.organization.id;

      // Create a data source
      await request(app.getHttpServer())
        .post(`/organizations/${orgId}/data-sources`)
        .set('Cookie', admin.cookie)
        .send({
          name: 'Bank Payouts',
          type: DataSourceType.BANK,
          columnMapping: sampleMapping,
        });

      // Add Analyst
      const analystUser = await authRepo.createUser({
        email: 'analyst@corp.com',
        name: 'Analyst Bob',
        passwordHash: 'hash',
        status: 'ACTIVE',
      });
      await authRepo.createMembership(analystUser.id, orgId, Role.ANALYST);

      const tokenService = app.get(TokenService);
      const token = await tokenService.generateAccessToken({
        sub: analystUser.id,
        email: analystUser.email,
      });

      const res = await request(app.getHttpServer())
        .get(`/organizations/${orgId}/data-sources`)
        .set('Cookie', [`access_token=${token}`]);

      expect(res.status).toBe(HttpStatus.OK);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].name).toBe('Bank Payouts');
    });
  });

  describe('Tenant Isolation', () => {
    it('should return 404 when user in Org A attempts to access Org B data source', async () => {
      const orgA = await registerUser('adminA@corp.com', 'Org A');
      const orgB = await registerUser('adminB@corp.com', 'Org B');

      const dsB = await dsRepo.create(orgB.body.organization.id, {
        name: 'Org B Secret Source',
        type: DataSourceType.INTERNAL_ORDERS,
        columnMapping: sampleMapping,
      });

      // User A attempts to access Org B data source using Org B's ID
      const res = await request(app.getHttpServer())
        .get(`/organizations/${orgB.body.organization.id}/data-sources/${dsB.id}`)
        .set('Cookie', orgA.cookie);

      // OrgGuard prevents IDOR: returns 404
      expect(res.status).toBe(HttpStatus.NOT_FOUND);
    });
  });

  describe('Data Source Lifecycle & Deletion Guard', () => {
    it('should block deletion if data source has associated transactions (400 Bad Request)', async () => {
      const admin = await registerUser('admin@corp.com', 'Acme Corp');
      const orgId = admin.body.organization.id;

      const ds = await dsRepo.create(orgId, {
        name: 'Production Stripe',
        type: DataSourceType.PAYMENT_GATEWAY,
        columnMapping: sampleMapping,
      });

      // Simulate 5 existing transactions for this data source
      dsRepo.transactionsCountMap.set(ds.id, 5);

      const res = await request(app.getHttpServer())
        .delete(`/organizations/${orgId}/data-sources/${ds.id}`)
        .set('Cookie', admin.cookie);

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
      expect(res.body.message).toContain('associated transactions');
    });

    it('should soft-delete data source when no transactions exist', async () => {
      const admin = await registerUser('admin@corp.com', 'Acme Corp');
      const orgId = admin.body.organization.id;

      const ds = await dsRepo.create(orgId, {
        name: 'Empty Source',
        type: DataSourceType.OTHER,
        columnMapping: sampleMapping,
      });

      const res = await request(app.getHttpServer())
        .delete(`/organizations/${orgId}/data-sources/${ds.id}`)
        .set('Cookie', admin.cookie);

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.success).toBe(true);

      // Verify soft deletion
      const updated = await dsRepo.findById(orgId, ds.id);
      expect(updated?.status).toBe('ARCHIVED');
    });
  });
});
