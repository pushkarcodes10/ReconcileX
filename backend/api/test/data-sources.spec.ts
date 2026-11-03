import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSourceStatus, DataSourceType, Role, User } from '@reconcilex/db';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
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
    app.setGlobalPrefix('api/v1');
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
    authRepo.clear();
    orgRepo.clear();
    dsRepo.dataSources = [];
    dsRepo.transactionsCountMap.clear();
  });

  const registerUser = async (email: string, orgName: string, name: string = 'Test User') => {
    const res = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      name,
      email,
      password: 'Password123!',
      orgName,
    });

    const user = res.body.user;
    const organization = res.body.organization;
    const cookies = res.headers['set-cookie'] as unknown as string[];

    if (user && organization) {
      orgRepo.users.set(user.id, {
        id: user.id,
        name: user.name,
        email: user.email,
        passwordHash: 'hash',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      orgRepo.organizations.set(organization.id, {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      orgRepo.memberships.set(`m-${user.id}-${organization.id}`, {
        id: `m-${user.id}-${organization.id}`,
        userId: user.id,
        organizationId: organization.id,
        role: Role.ADMIN,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return {
      body: { user, organization },
      cookie: cookies,
    };
  };

  const createUserWithRole = async (
    email: string,
    orgId: string,
    role: Role,
    name: string = 'Member',
  ) => {
    const userId = randomUUID();
    const user: User = {
      id: userId,
      email,
      passwordHash: 'hash',
      name,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    authRepo.users.set(userId, user);
    authRepo.memberships.set(`m-${userId}-${orgId}`, {
      id: `m-${userId}-${orgId}`,
      userId,
      organizationId: orgId,
      role,
      createdAt: new Date(),
    });

    orgRepo.users.set(userId, user);
    orgRepo.memberships.set(`m-${userId}-${orgId}`, {
      id: `m-${userId}-${orgId}`,
      userId,
      organizationId: orgId,
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const tokenService = app.get(TokenService);
    const token = await tokenService.generateAccessToken({
      sub: userId,
      email,
    });

    return { user, token };
  };

  const sampleMapping = {
    external_id: 'Order ID',
    amount: 'Gross Amount',
    date: 'Timestamp',
    currency: 'Currency',
    reference: 'Invoice Ref',
  };

  describe('Data Source Creation & Validation', () => {
    it('should allow an ADMIN to create a valid data source', async () => {
      const { body, cookie } = await registerUser('admin@corp.com', 'Acme Corp');
      const orgId = body.organization.id;

      const res = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/data-sources`)
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
      expect(res.body.columnMapping.external_id).toBe('Order ID');
      expect(res.body.status).toBe('ACTIVE');
    });

    it('should allow FINANCE_MANAGER to create a valid data source', async () => {
      const admin = await registerUser('admin2@corp.com', 'Acme Corp 2');
      const orgId = admin.body.organization.id;

      const { token } = await createUserWithRole(
        'fm@corp.com',
        orgId,
        Role.FINANCE_MANAGER,
        'Finance Manager',
      );

      const res = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/data-sources`)
        .set('Cookie', [`access_token=${token}`])
        .send({
          name: 'Stripe Gateway',
          type: DataSourceType.PAYMENT_GATEWAY,
          columnMapping: sampleMapping,
        });

      expect(res.status).toBe(HttpStatus.CREATED);
      expect(res.body.name).toBe('Stripe Gateway');
    });

    it('should reject data source with duplicate name in same organization', async () => {
      const { body, cookie } = await registerUser('admin@corp.com', 'Acme Corp');
      const orgId = body.organization.id;

      await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/data-sources`)
        .set('Cookie', cookie)
        .send({
          name: 'Stripe Gateway',
          type: DataSourceType.PAYMENT_GATEWAY,
          columnMapping: sampleMapping,
        });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/data-sources`)
        .set('Cookie', cookie)
        .send({
          name: 'Stripe Gateway',
          type: DataSourceType.PAYMENT_GATEWAY,
          columnMapping: sampleMapping,
        });

      expect(res.status).toBe(HttpStatus.CONFLICT);
      const msg = res.body.error?.message || res.body.message;
      expect(msg).toContain('already exists');
    });

    it('should allow the same data source name in different organizations', async () => {
      const orgA = await registerUser('adminA@corp.com', 'Org A');
      const orgB = await registerUser('adminB@corp.com', 'Org B');

      const resA = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgA.body.organization.id}/data-sources`)
        .set('Cookie', orgA.cookie)
        .send({
          name: 'Shared Name',
          type: DataSourceType.BANK,
          columnMapping: sampleMapping,
        });
      expect(resA.status).toBe(HttpStatus.CREATED);

      const resB = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgB.body.organization.id}/data-sources`)
        .set('Cookie', orgB.cookie)
        .send({
          name: 'Shared Name',
          type: DataSourceType.BANK,
          columnMapping: sampleMapping,
        });
      expect(resB.status).toBe(HttpStatus.CREATED);
    });

    it('should reject invalid source types', async () => {
      const { body, cookie } = await registerUser('admin@corp.com', 'Acme Corp');
      const orgId = body.organization.id;

      const res = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/data-sources`)
        .set('Cookie', cookie)
        .send({
          name: 'Invalid Type Source',
          type: 'NOT_A_REAL_TYPE',
          columnMapping: sampleMapping,
        });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should reject column mapping missing mandatory fields (external_id, amount, date, currency)', async () => {
      const { body, cookie } = await registerUser('admin@corp.com', 'Acme Corp');
      const orgId = body.organization.id;

      const res = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/data-sources`)
        .set('Cookie', cookie)
        .send({
          name: 'Invalid Mapping Source',
          type: DataSourceType.BANK,
          columnMapping: {
            external_id: 'ID',
            amount: 'Amount',
            // Missing date and currency
          },
        });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe('Role-Based Access Control on Data Sources', () => {
    it('should forbid an ANALYST from creating a data source (403 Forbidden)', async () => {
      const admin = await registerUser('admin@corp.com', 'Acme Corp');
      const orgId = admin.body.organization.id;

      const { token } = await createUserWithRole(
        'analyst@corp.com',
        orgId,
        Role.ANALYST,
        'Analyst Bob',
      );

      const res = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/data-sources`)
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

      await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/data-sources`)
        .set('Cookie', admin.cookie)
        .send({
          name: 'Bank Payouts',
          type: DataSourceType.BANK,
          columnMapping: sampleMapping,
        });

      const { token } = await createUserWithRole(
        'analyst@corp.com',
        orgId,
        Role.ANALYST,
        'Analyst Bob',
      );

      const res = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/data-sources`)
        .set('Cookie', [`access_token=${token}`]);

      expect(res.status).toBe(HttpStatus.OK);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].name).toBe('Bank Payouts');
    });
  });

  describe('Tenant Isolation & Querying', () => {
    it('should return 404 when user in Org A attempts to access Org B data source', async () => {
      const orgA = await registerUser('adminA@corp.com', 'Org A');
      const orgB = await registerUser('adminB@corp.com', 'Org B');

      const dsB = await dsRepo.create(orgB.body.organization.id, {
        name: 'Org B Secret Source',
        type: DataSourceType.INTERNAL_ORDERS,
        columnMapping: sampleMapping,
      });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgB.body.organization.id}/data-sources/${dsB.id}`)
        .set('Cookie', orgA.cookie);

      expect(res.status).toBe(HttpStatus.NOT_FOUND);
    });

    it('should support pagination and filtering on data sources list', async () => {
      const { body, cookie } = await registerUser('admin@corp.com', 'Acme Corp');
      const orgId = body.organization.id;

      await dsRepo.create(orgId, {
        name: 'Source 1',
        type: DataSourceType.INTERNAL_ORDERS,
        columnMapping: sampleMapping,
      });
      await dsRepo.create(orgId, {
        name: 'Source 2',
        type: DataSourceType.PAYMENT_GATEWAY,
        columnMapping: sampleMapping,
      });
      await dsRepo.create(orgId, {
        name: 'Source 3',
        type: DataSourceType.BANK,
        columnMapping: sampleMapping,
      });

      // Filter by type
      const resFilter = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/data-sources?type=BANK`)
        .set('Cookie', cookie);
      expect(resFilter.status).toBe(HttpStatus.OK);
      expect(resFilter.body.length).toBe(1);
      expect(resFilter.body[0].name).toBe('Source 3');

      // Paginated query
      const resPaginated = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/data-sources?page=1&limit=2`)
        .set('Cookie', cookie);
      expect(resPaginated.status).toBe(HttpStatus.OK);
      expect(resPaginated.body.total).toBe(3);
      expect(resPaginated.body.data.length).toBe(2);
      expect(resPaginated.body.totalPages).toBe(2);
    });

    it('should update data source configuration (PATCH)', async () => {
      const { body, cookie } = await registerUser('admin@corp.com', 'Acme Corp');
      const orgId = body.organization.id;

      const ds = await dsRepo.create(orgId, {
        name: 'Original Source',
        type: DataSourceType.OTHER,
        columnMapping: sampleMapping,
      });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/orgs/${orgId}/data-sources/${ds.id}`)
        .set('Cookie', cookie)
        .send({
          name: 'Updated Source Name',
          status: DataSourceStatus.INACTIVE,
        });

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.name).toBe('Updated Source Name');
      expect(res.body.status).toBe('INACTIVE');
    });
  });

  describe('Data Source Lifecycle & Deletion Guard', () => {
    it('should block deletion if data source has associated transactions (409 Conflict)', async () => {
      const admin = await registerUser('admin@corp.com', 'Acme Corp');
      const orgId = admin.body.organization.id;

      const ds = await dsRepo.create(orgId, {
        name: 'Production Stripe',
        type: DataSourceType.PAYMENT_GATEWAY,
        columnMapping: sampleMapping,
      });

      dsRepo.transactionsCountMap.set(ds.id, 5);

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/orgs/${orgId}/data-sources/${ds.id}`)
        .set('Cookie', admin.cookie);

      expect(res.status).toBe(HttpStatus.CONFLICT);
      const msg = res.body.error?.message || res.body.message;
      expect(msg).toContain('associated transactions');
    });

    it('should soft-delete data source when no transactions exist and exclude from reads', async () => {
      const admin = await registerUser('admin@corp.com', 'Acme Corp');
      const orgId = admin.body.organization.id;

      const ds = await dsRepo.create(orgId, {
        name: 'Empty Source',
        type: DataSourceType.OTHER,
        columnMapping: sampleMapping,
      });

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/orgs/${orgId}/data-sources/${ds.id}`)
        .set('Cookie', admin.cookie);

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.success).toBe(true);

      // Verify soft deletion excludes from findById
      const getRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/data-sources/${ds.id}`)
        .set('Cookie', admin.cookie);
      expect(getRes.status).toBe(HttpStatus.NOT_FOUND);

      // Verify soft deletion allows creating another source with the same name
      const recreateRes = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/data-sources`)
        .set('Cookie', admin.cookie)
        .send({
          name: 'Empty Source',
          type: DataSourceType.OTHER,
          columnMapping: sampleMapping,
        });
      expect(recreateRes.status).toBe(HttpStatus.CREATED);
    });
  });
});
