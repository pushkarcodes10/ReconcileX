import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Role, Transaction, TransactionStatus } from '@reconcilex/db';
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
import { OrganizationsService } from '../src/modules/organizations/organizations.service';
import { InMemoryOrganizationsRepository } from '../src/modules/organizations/repositories/in-memory-organizations.repository';
import { ORGANIZATIONS_REPOSITORY } from '../src/modules/organizations/repositories/organizations.repository.interface';
import { InMemoryTransactionsRepository } from '../src/modules/transactions/repositories/in-memory-transactions.repository';
import { TRANSACTIONS_REPOSITORY } from '../src/modules/transactions/repositories/transactions.repository.interface';
import { TransactionsController } from '../src/modules/transactions/transactions.controller';
import { TransactionsService } from '../src/modules/transactions/transactions.service';

describe('Transactions Read APIs (Phase A3)', () => {
  let app: INestApplication;
  let authRepo: InMemoryAuthRepository;
  let orgRepo: InMemoryOrganizationsRepository;
  let txnRepo: InMemoryTransactionsRepository;

  beforeAll(async () => {
    authRepo = new InMemoryAuthRepository();
    orgRepo = new InMemoryOrganizationsRepository();
    txnRepo = new InMemoryTransactionsRepository();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configuration],
        }),
        JwtModule.register({}),
      ],
      controllers: [AuthController, TransactionsController],
      providers: [
        AuthService,
        PasswordService,
        TokenService,
        JwtAuthGuard,
        OrganizationsService,
        TransactionsService,
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
          provide: TRANSACTIONS_REPOSITORY,
          useValue: txnRepo,
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
    txnRepo.transactions = [];
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

  const createDummyTxn = (
    organizationId: string,
    dataSourceId: string,
    externalId: string,
    amountMinor: number,
    currency: string = 'USD',
    reference?: string,
    date: Date = new Date(),
    status: TransactionStatus = TransactionStatus.UNMATCHED,
  ): Transaction => ({
    id: randomUUID(),
    organizationId,
    dataSourceId,
    externalId,
    amountMinor,
    currency,
    transactionDate: date,
    reference: reference || null,
    externalTxnId: null,
    merchantOrOrderId: null,
    txnType: 'CHARGE',
    status,
    normalizedPayload: { sample: 'data' },
    fingerprint: 'sha256-dummy-fingerprint',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  describe('GET /orgs/:orgId/transactions', () => {
    it('should return empty paginated result on empty table (200 OK)', async () => {
      const { body, cookie } = await registerUser('admin@corp.com', 'Acme Corp');
      const orgId = body.organization.id;

      const res = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/transactions`)
        .set('Cookie', cookie);

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.data).toEqual([]);
      expect(res.body.total).toBe(0);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(20);
      expect(res.body.totalPages).toBe(0);
      expect(res.body.hasMore).toBe(false);
      expect(res.body.nextCursor).toBeNull();
    });

    it('should query transactions and apply filters correctly (dateFrom, dateTo, amount, status, q, sourceId)', async () => {
      const { body, cookie } = await registerUser('admin@corp.com', 'Acme Corp');
      const orgId = body.organization.id;
      const dsId1 = randomUUID();
      const dsId2 = randomUUID();

      txnRepo.transactions.push(
        createDummyTxn(
          orgId,
          dsId1,
          'ORD-001',
          10000,
          'USD',
          'INV-100',
          new Date('2026-01-10T10:00:00Z'),
          TransactionStatus.UNMATCHED,
        ),
        createDummyTxn(
          orgId,
          dsId1,
          'ORD-002',
          25000,
          'USD',
          'INV-200',
          new Date('2026-01-15T10:00:00Z'),
          TransactionStatus.MATCHED,
        ),
        createDummyTxn(
          orgId,
          dsId2,
          'ORD-003',
          50000,
          'EUR',
          'INV-300',
          new Date('2026-01-20T10:00:00Z'),
          TransactionStatus.UNMATCHED,
        ),
      );

      // Filter by sourceId
      const resSource = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/transactions?sourceId=${dsId1}`)
        .set('Cookie', cookie);
      expect(resSource.status).toBe(HttpStatus.OK);
      expect(resSource.body.total).toBe(2);

      // Filter by status
      const resStatus = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/transactions?status=MATCHED`)
        .set('Cookie', cookie);
      expect(resStatus.status).toBe(HttpStatus.OK);
      expect(resStatus.body.total).toBe(1);
      expect(resStatus.body.data[0].externalId).toBe('ORD-002');

      // Filter by exact amount
      const resAmount = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/transactions?amount=25000`)
        .set('Cookie', cookie);
      expect(resAmount.status).toBe(HttpStatus.OK);
      expect(resAmount.body.total).toBe(1);
      expect(resAmount.body.data[0].externalId).toBe('ORD-002');

      // Filter by minAmount
      const resMinAmount = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/transactions?minAmount=20000`)
        .set('Cookie', cookie);
      expect(resMinAmount.status).toBe(HttpStatus.OK);
      expect(resMinAmount.body.total).toBe(2);

      // Filter by currency
      const resCurrency = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/transactions?currency=EUR`)
        .set('Cookie', cookie);
      expect(resCurrency.status).toBe(HttpStatus.OK);
      expect(resCurrency.body.total).toBe(1);
      expect(resCurrency.body.data[0].externalId).toBe('ORD-003');

      // Search keyword `q`
      const resSearch = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/transactions?q=INV-100`)
        .set('Cookie', cookie);
      expect(resSearch.status).toBe(HttpStatus.OK);
      expect(resSearch.body.total).toBe(1);
      expect(resSearch.body.data[0].externalId).toBe('ORD-001');

      // Date range filter using dateFrom & dateTo
      const resDate = await request(app.getHttpServer())
        .get(
          `/api/v1/orgs/${orgId}/transactions?dateFrom=2026-01-12T00:00:00Z&dateTo=2026-01-18T00:00:00Z`,
        )
        .set('Cookie', cookie);
      expect(resDate.status).toBe(HttpStatus.OK);
      expect(resDate.body.total).toBe(1);
      expect(resDate.body.data[0].externalId).toBe('ORD-002');

      // Verify list response does NOT expose normalizedPayload
      expect(resDate.body.data[0].normalizedPayload).toBeUndefined();
    });

    it('should paginate results properly with offset pagination', async () => {
      const { body, cookie } = await registerUser('admin@corp.com', 'Acme Corp');
      const orgId = body.organization.id;
      const dsId = randomUUID();

      for (let i = 1; i <= 5; i++) {
        txnRepo.transactions.push(
          createDummyTxn(
            orgId,
            dsId,
            `ORD-00${i}`,
            i * 1000,
            'USD',
            `REF-${i}`,
            new Date(2026, 0, i),
          ),
        );
      }

      const res = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/transactions?page=2&limit=2`)
        .set('Cookie', cookie);

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.total).toBe(5);
      expect(res.body.data.length).toBe(2);
      expect(res.body.page).toBe(2);
      expect(res.body.limit).toBe(2);
      expect(res.body.totalPages).toBe(3);
      expect(res.body.hasMore).toBe(true);
      expect(res.body.nextCursor).toBeDefined();
    });

    it('should paginate results properly with cursor pagination', async () => {
      const { body, cookie } = await registerUser('admin@corp.com', 'Acme Corp');
      const orgId = body.organization.id;
      const dsId = randomUUID();

      for (let i = 1; i <= 5; i++) {
        txnRepo.transactions.push(
          createDummyTxn(
            orgId,
            dsId,
            `ORD-00${i}`,
            i * 1000,
            'USD',
            `REF-${i}`,
            new Date(2026, 0, i),
          ),
        );
      }

      // Fetch page 1 with limit 2
      const resPage1 = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/transactions?limit=2`)
        .set('Cookie', cookie);

      expect(resPage1.status).toBe(HttpStatus.OK);
      expect(resPage1.body.data.length).toBe(2);
      expect(resPage1.body.hasMore).toBe(true);
      const cursor = resPage1.body.nextCursor;
      expect(cursor).toBeDefined();

      // Fetch page 2 using cursor
      const resPage2 = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/transactions?cursor=${cursor}&limit=2`)
        .set('Cookie', cookie);

      expect(resPage2.status).toBe(HttpStatus.OK);
      expect(resPage2.body.data.length).toBe(2);
    });

    it('should reject invalid query parameters', async () => {
      const { body, cookie } = await registerUser('admin@corp.com', 'Acme Corp');
      const orgId = body.organization.id;

      // Invalid limit (> 100)
      const resLimit = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/transactions?limit=200`)
        .set('Cookie', cookie);
      expect(resLimit.status).toBe(HttpStatus.BAD_REQUEST);

      // Invalid status
      const resStatus = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/transactions?status=NOT_A_STATUS`)
        .set('Cookie', cookie);
      expect(resStatus.status).toBe(HttpStatus.BAD_REQUEST);

      // Invalid sourceId (not a UUID)
      const resUuid = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/transactions?sourceId=not-a-uuid`)
        .set('Cookie', cookie);
      expect(resUuid.status).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe('GET /orgs/:orgId/transactions/:id', () => {
    it('should retrieve single transaction details including normalized payload', async () => {
      const { body, cookie } = await registerUser('admin@corp.com', 'Acme Corp');
      const orgId = body.organization.id;
      const dsId = randomUUID();

      const txn = createDummyTxn(orgId, dsId, 'ORD-999', 4200, 'USD', 'REF-999');
      txnRepo.transactions.push(txn);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/transactions/${txn.id}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.id).toBe(txn.id);
      expect(res.body.externalId).toBe('ORD-999');
      expect(res.body.amountMinor).toBe(4200);
      expect(res.body.normalizedPayload).toEqual({ sample: 'data' });
      expect(res.body.fingerprint).toBe('sha256-dummy-fingerprint');
    });

    it('should return 404 when transaction is not found in organization', async () => {
      const { body, cookie } = await registerUser('admin@corp.com', 'Acme Corp');
      const orgId = body.organization.id;
      const fakeId = randomUUID();

      const res = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/transactions/${fakeId}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(HttpStatus.NOT_FOUND);
    });

    it('should return 404 when user in Org A attempts to access transaction in Org B', async () => {
      const orgA = await registerUser('adminA@corp.com', 'Org A');
      const orgB = await registerUser('adminB@corp.com', 'Org B');

      const txnB = createDummyTxn(orgB.body.organization.id, randomUUID(), 'ORG-B-TXN', 50000);
      txnRepo.transactions.push(txnB);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgB.body.organization.id}/transactions/${txnB.id}`)
        .set('Cookie', orgA.cookie);

      // OrgGuard prevents IDOR: returns 404
      expect(res.status).toBe(HttpStatus.NOT_FOUND);
    });
  });
});
