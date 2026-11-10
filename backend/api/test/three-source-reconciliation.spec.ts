import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSourceStatus, Role, TransactionStatus } from '@reconcilex/db';
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
import { ExceptionsService } from '../src/modules/exceptions/exceptions.service';
import { EXCEPTIONS_REPOSITORY } from '../src/modules/exceptions/repositories/exceptions.repository.interface';
import { InMemoryExceptionsRepository } from '../src/modules/exceptions/repositories/in-memory-exceptions.repository';
import { OrganizationsService } from '../src/modules/organizations/organizations.service';
import { InMemoryOrganizationsRepository } from '../src/modules/organizations/repositories/in-memory-organizations.repository';
import { ORGANIZATIONS_REPOSITORY } from '../src/modules/organizations/repositories/organizations.repository.interface';
import { RECONCILIATION_JOB_SERVICE } from '../src/modules/reconciliation/job/reconciliation-job.interface';
import { SyncReconciliationJobService } from '../src/modules/reconciliation/job/sync-reconciliation-job.service';
import { ReconciliationController } from '../src/modules/reconciliation/reconciliation.controller';
import { ReconciliationService } from '../src/modules/reconciliation/reconciliation.service';
import { InMemoryReconciliationRepository } from '../src/modules/reconciliation/repositories/in-memory-reconciliation.repository';
import { RECONCILIATION_REPOSITORY } from '../src/modules/reconciliation/repositories/reconciliation.repository.interface';
import { InMemoryTransactionsRepository } from '../src/modules/transactions/repositories/in-memory-transactions.repository';
import { TRANSACTIONS_REPOSITORY } from '../src/modules/transactions/repositories/transactions.repository.interface';
import { TransactionsController } from '../src/modules/transactions/transactions.controller';
import { TransactionsService } from '../src/modules/transactions/transactions.service';

describe('Native Three-Source Reconciliation Integration Tests', () => {
  let app: INestApplication;
  let authRepo: InMemoryAuthRepository;
  let orgRepo: InMemoryOrganizationsRepository;
  let dataSourcesRepo: InMemoryDataSourcesRepository;
  let txnRepo: InMemoryTransactionsRepository;
  let reconciliationRepo: InMemoryReconciliationRepository;
  let exceptionsRepo: InMemoryExceptionsRepository;

  beforeAll(async () => {
    authRepo = new InMemoryAuthRepository();
    orgRepo = new InMemoryOrganizationsRepository();
    dataSourcesRepo = new InMemoryDataSourcesRepository();
    txnRepo = new InMemoryTransactionsRepository();
    reconciliationRepo = new InMemoryReconciliationRepository(dataSourcesRepo, txnRepo);
    exceptionsRepo = new InMemoryExceptionsRepository();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configuration],
        }),
        JwtModule.register({}),
      ],
      controllers: [
        AuthController,
        DataSourcesController,
        TransactionsController,
        ReconciliationController,
      ],
      providers: [
        AuthService,
        PasswordService,
        TokenService,
        JwtAuthGuard,
        OrganizationsService,
        DataSourcesService,
        TransactionsService,
        ExceptionsService,
        ReconciliationService,
        SyncReconciliationJobService,
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
          useValue: dataSourcesRepo,
        },
        {
          provide: TRANSACTIONS_REPOSITORY,
          useValue: txnRepo,
        },
        {
          provide: RECONCILIATION_REPOSITORY,
          useValue: reconciliationRepo,
        },
        {
          provide: EXCEPTIONS_REPOSITORY,
          useValue: exceptionsRepo,
        },
        {
          provide: RECONCILIATION_JOB_SERVICE,
          useClass: SyncReconciliationJobService,
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
    dataSourcesRepo.clear();
    txnRepo.clear();
    reconciliationRepo.clear();
    exceptionsRepo.clear();
  });

  const registerUser = async (
    email: string,
    orgName: string,
    role: Role = Role.ADMIN,
    name: string = 'Test User',
  ) => {
    const res = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email,
      password: 'Password123!',
      name,
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
        role,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return { cookies, orgId: organization.id, userId: user.id };
  };

  const createDataSource = async (
    cookies: string[],
    orgId: string,
    name: string,
    type: 'INTERNAL_ORDERS' | 'PAYMENT_GATEWAY' | 'BANK',
  ) => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/orgs/${orgId}/data-sources`)
      .set('Cookie', cookies)
      .send({
        name,
        type,
        columnMapping: {
          external_id: 'order_id',
          amount: 'amount',
          currency: 'currency',
          date: 'date',
        },
      });
    return res.body;
  };

  it('1. should reject 3-source reconciliation if Source A, B, and C are not mutually distinct', async () => {
    const user = await registerUser('admin1@test.com', 'Org 1');
    const dsA = await createDataSource(user.cookies, user.orgId, 'Internal Orders', 'INTERNAL_ORDERS');
    const dsB = await createDataSource(user.cookies, user.orgId, 'Payment Gateway', 'PAYMENT_GATEWAY');

    // Source C same as Source A
    const res = await request(app.getHttpServer())
      .post(`/api/v1/orgs/${user.orgId}/reconciliation-runs`)
      .set('Cookie', user.cookies)
      .send({
        reconciliationType: 'THREE_SOURCE',
        sourceA: dsA.id,
        sourceB: dsB.id,
        sourceC: dsA.id,
        dateFrom: '2026-09-01T00:00:00Z',
        dateTo: '2026-09-30T23:59:59Z',
      })
      .expect(HttpStatus.BAD_REQUEST);

    expect(res.body.message || res.body.error).toBeDefined();
  });

  it('2. should reject 3-source reconciliation if Source C is missing when reconciliationType is THREE_SOURCE', async () => {
    const user = await registerUser('admin2@test.com', 'Org 2');
    const dsA = await createDataSource(user.cookies, user.orgId, 'Internal Orders', 'INTERNAL_ORDERS');
    const dsB = await createDataSource(user.cookies, user.orgId, 'Payment Gateway', 'PAYMENT_GATEWAY');

    const res = await request(app.getHttpServer())
      .post(`/api/v1/orgs/${user.orgId}/reconciliation-runs`)
      .set('Cookie', user.cookies)
      .send({
        reconciliationType: 'THREE_SOURCE',
        sourceA: dsA.id,
        sourceB: dsB.id,
        dateFrom: '2026-09-01T00:00:00Z',
        dateTo: '2026-09-30T23:59:59Z',
      })
      .expect(HttpStatus.BAD_REQUEST);

    expect(res.body.message || res.body.error).toBeDefined();
  });

  it('3. should execute 3-source reconciliation successfully across Full Match, Partial Match, and Amount Mismatch', async () => {
    const user = await registerUser('admin3@test.com', 'Org 3');
    const dsA = await createDataSource(user.cookies, user.orgId, 'Internal Orders', 'INTERNAL_ORDERS');
    const dsB = await createDataSource(user.cookies, user.orgId, 'Payment Gateway', 'PAYMENT_GATEWAY');
    const dsC = await createDataSource(user.cookies, user.orgId, 'Bank Statement', 'BANK');

    // 1. Scenario A: Fully Matched across A, B, C
    // ORD-1001 (₹999), TXN-2001 (₹999, ref=ORD-1001), BNK-3001 (₹999, extTxnId=TXN-2001)
    await txnRepo.createBatch(user.orgId, [
      {
        organizationId: user.orgId,
        dataSourceId: dsA.id,
        externalId: 'ORD-1001',
        amountMinor: 99900,
        currency: 'INR',
        transactionDate: new Date('2026-09-15T10:00:00Z'),
        status: TransactionStatus.IMPORTED,
      },
    ]);
    await txnRepo.createBatch(user.orgId, [
      {
        organizationId: user.orgId,
        dataSourceId: dsB.id,
        externalId: 'TXN-2001',
        reference: 'ORD-1001',
        amountMinor: 99900,
        currency: 'INR',
        transactionDate: new Date('2026-09-15T10:05:00Z'),
        status: TransactionStatus.IMPORTED,
      },
    ]);
    await txnRepo.createBatch(user.orgId, [
      {
        organizationId: user.orgId,
        dataSourceId: dsC.id,
        externalId: 'BNK-3001',
        externalTxnId: 'TXN-2001',
        amountMinor: 99900,
        currency: 'INR',
        transactionDate: new Date('2026-09-16T12:00:00Z'),
        status: TransactionStatus.IMPORTED,
      },
    ]);

    // 2. Scenario B: Partially Matched (A & B match, C missing)
    await txnRepo.createBatch(user.orgId, [
      {
        organizationId: user.orgId,
        dataSourceId: dsA.id,
        externalId: 'ORD-1002',
        amountMinor: 50000,
        currency: 'INR',
        transactionDate: new Date('2026-09-15T11:00:00Z'),
        status: TransactionStatus.IMPORTED,
      },
      {
        organizationId: user.orgId,
        dataSourceId: dsB.id,
        externalId: 'TXN-2002',
        reference: 'ORD-1002',
        amountMinor: 50000,
        currency: 'INR',
        transactionDate: new Date('2026-09-15T11:05:00Z'),
        status: TransactionStatus.IMPORTED,
      },
    ]);

    // 3. Scenario C: Amount Mismatch (A=1000, B=1000, C=950)
    await txnRepo.createBatch(user.orgId, [
      {
        organizationId: user.orgId,
        dataSourceId: dsA.id,
        externalId: 'ORD-1003',
        amountMinor: 100000,
        currency: 'INR',
        transactionDate: new Date('2026-09-15T12:00:00Z'),
        status: TransactionStatus.IMPORTED,
      },
      {
        organizationId: user.orgId,
        dataSourceId: dsB.id,
        externalId: 'TXN-2003',
        reference: 'ORD-1003',
        amountMinor: 100000,
        currency: 'INR',
        transactionDate: new Date('2026-09-15T12:05:00Z'),
        status: TransactionStatus.IMPORTED,
      },
      {
        organizationId: user.orgId,
        dataSourceId: dsC.id,
        externalId: 'BNK-3003',
        externalTxnId: 'TXN-2003',
        amountMinor: 95000, // 950 INR vs 1000 INR
        currency: 'INR',
        transactionDate: new Date('2026-09-16T14:00:00Z'),
        status: TransactionStatus.IMPORTED,
      },
    ]);

    // Create 3-source run
    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/orgs/${user.orgId}/reconciliation-runs`)
      .set('Cookie', user.cookies)
      .send({
        reconciliationType: 'THREE_SOURCE',
        sourceA: dsA.id,
        sourceB: dsB.id,
        sourceC: dsC.id,
        dateFrom: '2026-09-01T00:00:00Z',
        dateTo: '2026-09-30T23:59:59Z',
        config: {
          dateToleranceDays: 3,
        },
      })
      .expect(HttpStatus.CREATED);

    const runId = createRes.body.run.id;
    expect(createRes.body.run.reconciliationType).toBe('THREE_SOURCE');
    expect(createRes.body.run.sourceCId).toBe(dsC.id);
    expect(createRes.body.run.status).toBe('COMPLETED');
    expect(createRes.body.run.fullyMatchedCount).toBe(1);
    expect(createRes.body.run.partiallyMatchedCount).toBe(1);
    expect(createRes.body.run.discrepancyCount).toBe(1);

    // Verify Matches returned by API
    const matchesRes = await request(app.getHttpServer())
      .get(`/api/v1/orgs/${user.orgId}/reconciliation-runs/${runId}/matches`)
      .set('Cookie', user.cookies)
      .expect(HttpStatus.OK);

    const matches = matchesRes.body.data;
    expect(matches.length).toBe(3);

    // 1. Scenario A: FULLY_MATCHED
    const fullMatch = matches.find((m: any) => m.classification === 'FULLY_MATCHED');
    expect(fullMatch).toBeDefined();
    expect(fullMatch.status).toBe('CONFIRMED');
    expect(fullMatch.transactionA.externalId).toBe('ORD-1001');
    expect(fullMatch.transactionB.externalId).toBe('TXN-2001');
    expect(fullMatch.transactionC.externalId).toBe('BNK-3001');

    // 2. Scenario B: PARTIALLY_MATCHED
    const partialMatch = matches.find((m: any) => m.classification === 'PARTIALLY_MATCHED');
    expect(partialMatch).toBeDefined();
    expect(partialMatch.status).toBe('PENDING');
    expect(partialMatch.transactionA.externalId).toBe('ORD-1002');
    expect(partialMatch.transactionB.externalId).toBe('TXN-2002');
    expect(partialMatch.transactionC).toBeNull();
    expect(partialMatch.discrepancyDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'MISSING_SOURCE',
          field: 'sourceC',
        }),
      ]),
    );

    // 3. Scenario C: AMOUNT_MISMATCH
    const amountMismatch = matches.find((m: any) => m.classification === 'AMOUNT_MISMATCH');
    expect(amountMismatch).toBeDefined();
    expect(amountMismatch.status).toBe('PENDING');
    expect(amountMismatch.transactionA.externalId).toBe('ORD-1003');
    expect(amountMismatch.transactionB.externalId).toBe('TXN-2003');
    expect(amountMismatch.transactionC.externalId).toBe('BNK-3003');
    expect(amountMismatch.discrepancyDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'AMOUNT',
          difference: 5000,
        }),
      ]),
    );

    // Verify Exceptions created for discrepancies (Partially matched and Amount mismatch)
    const exceptions = exceptionsRepo.exceptions.filter((e) => e.organizationId === user.orgId);
    expect(exceptions.length).toBeGreaterThanOrEqual(2);
    expect(exceptions.some((e) => e.transactionId === partialMatch.transactionA.id)).toBe(true);
    expect(exceptions.some((e) => e.transactionId === amountMismatch.transactionA.id)).toBe(true);
  });

  it('4. should enforce multi-tenant isolation on 3-source runs and matches', async () => {
    const org1 = await registerUser('org1admin@test.com', 'Org 1');
    const org2 = await registerUser('org2admin@test.com', 'Org 2');

    const dsA = await createDataSource(org1.cookies, org1.orgId, 'Orders', 'INTERNAL_ORDERS');
    const dsB = await createDataSource(org1.cookies, org1.orgId, 'PG', 'PAYMENT_GATEWAY');
    const dsC = await createDataSource(org1.cookies, org1.orgId, 'Bank', 'BANK');

    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/orgs/${org1.orgId}/reconciliation-runs`)
      .set('Cookie', org1.cookies)
      .send({
        reconciliationType: 'THREE_SOURCE',
        sourceA: dsA.id,
        sourceB: dsB.id,
        sourceC: dsC.id,
        dateFrom: '2026-09-01T00:00:00Z',
        dateTo: '2026-09-30T23:59:59Z',
      })
      .expect(HttpStatus.CREATED);

    const runId = createRes.body.run.id;

    // Org 2 user attempts to access Org 1 3-source run -> 404
    await request(app.getHttpServer())
      .get(`/api/v1/orgs/${org2.orgId}/reconciliation-runs/${runId}`)
      .set('Cookie', org2.cookies)
      .expect(HttpStatus.NOT_FOUND);

    // Org 2 user attempts to access Org 1 3-source matches -> 404
    await request(app.getHttpServer())
      .get(`/api/v1/orgs/${org2.orgId}/reconciliation-runs/${runId}/matches`)
      .set('Cookie', org2.cookies)
      .expect(HttpStatus.NOT_FOUND);
  });
});
