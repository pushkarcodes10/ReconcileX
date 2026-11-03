import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ExceptionStatus, ResolutionAction, Role } from '@reconcilex/db';
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
import { ExceptionsController } from '../src/modules/exceptions/exceptions.controller';
import { ExceptionsService } from '../src/modules/exceptions/exceptions.service';
import {
  EXCEPTIONS_REPOSITORY,
} from '../src/modules/exceptions/repositories/exceptions.repository.interface';
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

describe('Exception Management (Phase A7)', () => {
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
    exceptionsRepo = new InMemoryExceptionsRepository(authRepo, reconciliationRepo, txnRepo);

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
        ExceptionsController,
      ],
      providers: [
        AuthService,
        PasswordService,
        TokenService,
        JwtAuthGuard,
        OrganizationsService,
        DataSourcesService,
        TransactionsService,
        ReconciliationService,
        SyncReconciliationJobService,
        ExceptionsService,
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
          provide: RECONCILIATION_JOB_SERVICE,
          useClass: SyncReconciliationJobService,
        },
        {
          provide: EXCEPTIONS_REPOSITORY,
          useValue: exceptionsRepo,
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

  // Helper to register user and organization
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

  // Helper to create member in existing org
  const addMemberToOrg = async (
    email: string,
    orgId: string,
    role: Role = Role.ANALYST,
    name: string = 'Analyst User',
  ) => {
    const regRes = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email,
      password: 'Password123!',
      name,
      orgName: `Org For ${name}`,
    });

    const user = regRes.body.user;
    const cookies = regRes.headers['set-cookie'] as unknown as string[];

    orgRepo.memberships.set(`m-${user.id}-${orgId}`, {
      id: `m-${user.id}-${orgId}`,
      userId: user.id,
      organizationId: orgId,
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return { cookies, userId: user.id };
  };

  // Helper to create data source
  const createDataSource = async (
    cookies: string[],
    orgId: string,
    name: string,
    type: 'INTERNAL_ORDERS' | 'PAYMENT_GATEWAY' | 'BANK' | 'OTHER' = 'INTERNAL_ORDERS',
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
          date: 'date',
          currency: 'currency',
          reference: 'reference',
        },
      });
    return res.body;
  };

  // Helper to insert transactions
  const insertTransaction = async (
    orgId: string,
    dataSourceId: string,
    externalId: string,
    amountMinor: number,
    transactionDate: Date,
    reference?: string,
  ) => {
    return txnRepo.createBatch(orgId, [
      {
        dataSourceId,
        externalId,
        amountMinor,
        currency: 'USD',
        transactionDate,
        reference: reference || null,
        status: 'UNMATCHED',
      },
    ]);
  };

  describe('1. Automatic Exception Creation', () => {
    it('1. should automatically create OPEN exceptions for unmatched transactions upon reconciliation run completion', async () => {
      const { cookies, orgId } = await registerUser('admin@auto1.com', 'Auto 1 Corp');
      const dsA = await createDataSource(cookies, orgId, 'Source A');
      const dsB = await createDataSource(cookies, orgId, 'Source B');

      // 1 exact match pair ($100), 1 unmatched in A ($200), 1 unmatched in B ($300)
      const date = new Date('2026-10-15T12:00:00.000Z');
      await insertTransaction(orgId, dsA.id, 'TXN-EXACT-A', 10000, date, 'REF-100');
      await insertTransaction(orgId, dsB.id, 'TXN-EXACT-B', 10000, date, 'REF-100');
      const [unmatchedA] = await insertTransaction(orgId, dsA.id, 'TXN-UNMATCHED-A', 20000, date, 'REF-200');
      const [unmatchedB] = await insertTransaction(orgId, dsB.id, 'TXN-UNMATCHED-B', 30000, date, 'REF-300');

      const runRes = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/reconciliation-runs`)
        .set('Cookie', cookies)
        .send({
          sourceA: dsA.id,
          sourceB: dsB.id,
          dateFrom: '2026-10-01',
          dateTo: '2026-10-31',
        });

      expect(runRes.status).toBe(201);
      const runId = runRes.body.runId;

      // Verify exceptions created
      const excRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/exceptions`)
        .set('Cookie', cookies);

      expect(excRes.status).toBe(200);
      expect(excRes.body.data.length).toBe(2);

      const txnIds = excRes.body.data.map(
        (e: { transactionId?: string | null }) => e.transactionId,
      );
      expect(txnIds).toContain(unmatchedA.id);
      expect(txnIds).toContain(unmatchedB.id);

      // Verify statuses are OPEN
      for (const exc of excRes.body.data) {
        expect(exc.status).toBe(ExceptionStatus.OPEN);
        expect(exc.runId).toBe(runId);
      }
    });

    it('2. should not create exceptions for exact matches', async () => {
      const { cookies, orgId } = await registerUser('admin@auto2.com', 'Auto 2 Corp');
      const dsA = await createDataSource(cookies, orgId, 'Source A');
      const dsB = await createDataSource(cookies, orgId, 'Source B');

      const date = new Date('2026-10-15T12:00:00.000Z');
      const [exactA] = await insertTransaction(orgId, dsA.id, 'TXN-EX-A', 10000, date, 'REF-SAME');
      const [exactB] = await insertTransaction(orgId, dsB.id, 'TXN-EX-B', 10000, date, 'REF-SAME');

      await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/reconciliation-runs`)
        .set('Cookie', cookies)
        .send({
          sourceA: dsA.id,
          sourceB: dsB.id,
          dateFrom: '2026-10-01',
          dateTo: '2026-10-31',
        });

      const excRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/exceptions`)
        .set('Cookie', cookies);

      expect(excRes.body.data.length).toBe(0);
      const txnIds = excRes.body.data.map(
        (e: { transactionId?: string | null }) => e.transactionId,
      );
      expect(txnIds).not.toContain(exactA.id);
      expect(txnIds).not.toContain(exactB.id);
    });

    it('3. should not create exceptions for pending potential matches awaiting review', async () => {
      const { cookies, orgId } = await registerUser('admin@auto3.com', 'Auto 3 Corp');
      const dsA = await createDataSource(cookies, orgId, 'Source A');
      const dsB = await createDataSource(cookies, orgId, 'Source B');

      // Same reference, 1 day difference, slight amount difference -> potential match
      const dateA = new Date('2026-10-15T12:00:00.000Z');
      const dateB = new Date('2026-10-16T12:00:00.000Z');
      const [potA] = await insertTransaction(orgId, dsA.id, 'TXN-POT-A', 5000, dateA, 'REF-POTENTIAL');
      const [potB] = await insertTransaction(orgId, dsB.id, 'TXN-POT-B', 4800, dateB, 'REF-POTENTIAL');

      await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/reconciliation-runs`)
        .set('Cookie', cookies)
        .send({
          sourceA: dsA.id,
          sourceB: dsB.id,
          dateFrom: '2026-10-01',
          dateTo: '2026-10-31',
        });

      const excRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/exceptions`)
        .set('Cookie', cookies);

      const txnIds = excRes.body.data.map(
        (e: { transactionId?: string | null }) => e.transactionId,
      );
      expect(txnIds).not.toContain(potA.id);
      expect(txnIds).not.toContain(potB.id);
    });

    it('4. should automatically create an OPEN exception when a potential match is rejected and transaction has no remaining matches', async () => {
      const { cookies, orgId } = await registerUser('admin@auto4.com', 'Auto 4 Corp');
      const dsA = await createDataSource(cookies, orgId, 'Source A');
      const dsB = await createDataSource(cookies, orgId, 'Source B');

      const dateA = new Date('2026-10-15T12:00:00.000Z');
      const dateB = new Date('2026-10-16T12:00:00.000Z');
      const [potA] = await insertTransaction(orgId, dsA.id, 'TXN-REJ-A', 7500, dateA, 'REF-POT-REJ');
      const [potB] = await insertTransaction(orgId, dsB.id, 'TXN-REJ-B', 7200, dateB, 'REF-POT-REJ');

      const runRes = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/reconciliation-runs`)
        .set('Cookie', cookies)
        .send({
          sourceA: dsA.id,
          sourceB: dsB.id,
          dateFrom: '2026-10-01',
          dateTo: '2026-10-31',
        });

      const runId = runRes.body.runId;

      // Get match ID
      const matchesRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/reconciliation-runs/${runId}/matches`)
        .set('Cookie', cookies);

      expect(matchesRes.body.data.length).toBe(1);
      const matchId = matchesRes.body.data[0].id;

      // Reject match
      const rejectRes = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/matches/${matchId}/reject`)
        .set('Cookie', cookies)
        .send({ reason: 'Different counterparty detected on statement' });

      expect(rejectRes.status).toBe(200);

      // Verify exceptions created for both transactions
      const excRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/exceptions`)
        .set('Cookie', cookies);

      expect(excRes.status).toBe(200);
      const txnIds = excRes.body.data.map(
        (e: { transactionId?: string | null }) => e.transactionId,
      );
      expect(txnIds).toContain(potA.id);
      expect(txnIds).toContain(potB.id);
    });

    it('5. should not create duplicate exceptions if an open exception already exists for the transaction in that run', async () => {
      const { orgId } = await registerUser('admin@auto5.com', 'Auto 5 Corp');
      const runId = 'c1b9a6b1-4f1b-4f9e-9d2a-1b2c3d4e5f6b';
      const txnId = 't1b9a6b1-4f1b-4f9e-9d2a-1b2c3d4e5f6a';

      // Insert first exception
      await exceptionsRepo.createMany([
        {
          organizationId: orgId,
          runId,
          transactionId: txnId,
          status: ExceptionStatus.OPEN,
        },
      ]);

      // Attempt second insertion
      const secondBatch = await exceptionsRepo.createMany([
        {
          organizationId: orgId,
          runId,
          transactionId: txnId,
          status: ExceptionStatus.OPEN,
        },
      ]);

      expect(secondBatch.length).toBe(0);
      expect(exceptionsRepo.exceptions.length).toBe(1);
    });
  });

  describe('2. Listing Exceptions, Pagination, Sorting & Filtering', () => {
    let testOrgId: string;
    let testCookies: string[];
    let userAId: string;
    let userBId: string;
    let runId1: string;
    let runId2: string;

    beforeEach(async () => {
      const { cookies, orgId, userId } = await registerUser('admin@list.com', 'List Corp');
      testOrgId = orgId;
      testCookies = cookies;
      userAId = userId;

      const memberB = await addMemberToOrg('analyst.b@list.com', orgId, Role.ANALYST, 'Bob Analyst');
      userBId = memberB.userId;

      runId1 = '11111111-1111-4111-8111-111111111111';
      runId2 = '22222222-2222-4222-8222-222222222222';

      // Seed 4 exceptions with different statuses, assignees, dates, and transactions
      const now = new Date();
      await txnRepo.createBatch(orgId, [
        {
          id: 'txn-search-1',
          dataSourceId: 'ds-1',
          externalId: 'EXT-SEARCH-TARGET',
          amountMinor: 10000,
          currency: 'USD',
          transactionDate: now,
          reference: 'REF-INV-99',
          status: 'UNMATCHED',
        },
        {
          id: 'txn-search-2',
          dataSourceId: 'ds-1',
          externalId: 'EXT-OTHER-123',
          amountMinor: 20000,
          currency: 'USD',
          transactionDate: now,
          reference: 'SPECIAL-MEMO-XYZ',
          status: 'UNMATCHED',
        },
      ]);

      await exceptionsRepo.createMany([
        {
          id: 'exc-1',
          organizationId: orgId,
          runId: runId1,
          transactionId: 'txn-search-1',
          status: ExceptionStatus.OPEN,
          assigneeId: null,
          createdAt: new Date('2026-10-01T10:00:00.000Z'),
        },
        {
          id: 'exc-2',
          organizationId: orgId,
          runId: runId1,
          transactionId: 'txn-search-2',
          status: ExceptionStatus.ASSIGNED,
          assigneeId: userAId,
          createdAt: new Date('2026-10-10T10:00:00.000Z'),
        },
        {
          id: 'exc-3',
          organizationId: orgId,
          runId: runId2,
          transactionId: null,
          status: ExceptionStatus.UNDER_REVIEW,
          assigneeId: userBId,
          createdAt: new Date('2026-10-15T10:00:00.000Z'),
        },
        {
          id: 'exc-4',
          organizationId: orgId,
          runId: runId2,
          transactionId: null,
          status: ExceptionStatus.RESOLVED,
          assigneeId: userBId,
          resolutionReason: 'Resolved offline',
          resolutionAction: ResolutionAction.MANUALLY_RECONCILED,
          createdAt: new Date('2026-10-20T10:00:00.000Z'),
        },
      ]);
    });

    it('6. should list exceptions with default pagination and sorting by createdAt desc', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${testOrgId}/exceptions`)
        .set('Cookie', testCookies);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(4);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(20);
      expect(res.body.meta.total).toBe(4);
      expect(res.body.meta.totalPages).toBe(1);

      // Verify descending order by createdAt
      expect(res.body.data[0].id).toBe('exc-4');
      expect(res.body.data[1].id).toBe('exc-3');
      expect(res.body.data[2].id).toBe('exc-2');
      expect(res.body.data[3].id).toBe('exc-1');
    });

    it('7. should filter exceptions by status', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${testOrgId}/exceptions?status=OPEN`)
        .set('Cookie', testCookies);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe('exc-1');
      expect(res.body.data[0].status).toBe(ExceptionStatus.OPEN);
    });

    it('8. should filter exceptions by assigneeId', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${testOrgId}/exceptions?assigneeId=${userBId}`)
        .set('Cookie', testCookies);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data.map((e: { id: string }) => e.id)).toEqual(['exc-4', 'exc-3']);
    });

    it('9. should filter exceptions by runId', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${testOrgId}/exceptions?runId=${runId1}`)
        .set('Cookie', testCookies);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data.map((e: { id: string }) => e.id)).toEqual(['exc-2', 'exc-1']);
    });

    it('10. should filter exceptions by date range', async () => {
      const res = await request(app.getHttpServer())
        .get(
          `/api/v1/orgs/${testOrgId}/exceptions?createdFrom=2026-10-05T00:00:00.000Z&createdTo=2026-10-18T00:00:00.000Z`,
        )
        .set('Cookie', testCookies);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data.map((e: { id: string }) => e.id)).toEqual(['exc-3', 'exc-2']);
    });

    it('11. should filter exceptions by search term matching transaction external ID or reference', async () => {
      // Search by external ID substring
      const resExt = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${testOrgId}/exceptions?q=SEARCH-TARGET`)
        .set('Cookie', testCookies);

      expect(resExt.status).toBe(200);
      expect(resExt.body.data.length).toBe(1);
      expect(resExt.body.data[0].id).toBe('exc-1');

      // Search by reference substring
      const resRef = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${testOrgId}/exceptions?q=SPECIAL-MEMO`)
        .set('Cookie', testCookies);

      expect(resRef.status).toBe(200);
      expect(resRef.body.data.length).toBe(1);
      expect(resRef.body.data[0].id).toBe('exc-2');
    });

    it('12. should handle pagination correctly with limit and page parameters', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${testOrgId}/exceptions?page=2&limit=2`)
        .set('Cookie', testCookies);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.meta.page).toBe(2);
      expect(res.body.meta.limit).toBe(2);
      expect(res.body.meta.total).toBe(4);
      expect(res.body.meta.totalPages).toBe(2);
      expect(res.body.data[0].id).toBe('exc-2');
      expect(res.body.data[1].id).toBe('exc-1');
    });
  });

  describe('3. Exception Detail & Cross-Tenant Isolation', () => {
    let orgAId: string;
    let orgACookies: string[];
    let orgBCookies: string[];
    let excAId: string;

    beforeEach(async () => {
      const orgA = await registerUser('admin@orgA.com', 'Org A');
      orgAId = orgA.orgId;
      orgACookies = orgA.cookies;

      const orgB = await registerUser('admin@orgB.com', 'Org B');
      orgBCookies = orgB.cookies;

      const [exc] = await exceptionsRepo.createMany([
        {
          id: 'exc-detail-1',
          organizationId: orgAId,
          runId: 'run-detail-1',
          transactionId: null,
          status: ExceptionStatus.OPEN,
        },
      ]);
      excAId = exc.id;

      await exceptionsRepo.addComment(orgAId, excAId, orgA.userId, 'Initial investigation comment.');
    });

    it('13. should retrieve exception details including embedded metadata and comments', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgAId}/exceptions/${excAId}`)
        .set('Cookie', orgACookies);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(excAId);
      expect(res.body.status).toBe(ExceptionStatus.OPEN);
      expect(res.body.comments.length).toBe(1);
      expect(res.body.comments[0].body).toBe('Initial investigation comment.');
    });

    it('14. should return 404 when requesting a non-existent exception ID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgAId}/exceptions/00000000-0000-0000-0000-000000000000`)
        .set('Cookie', orgACookies);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('EXCEPTION_NOT_FOUND');
    });

    it('15. should prevent cross-tenant access (Org B cannot view Org A exception -> returns 404 IDOR prevention)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgAId}/exceptions/${excAId}`)
        .set('Cookie', orgBCookies);

      // OrgGuard rejects since user is not in Org A
      expect(res.status).toBe(404);
    });
  });

  describe('4. Exception Assignment & Validation', () => {
    let orgId: string;
    let cookies: string[];
    let analystId: string;
    let externalUserId: string;

    beforeEach(async () => {
      const reg = await registerUser('admin@assign.com', 'Assign Corp');
      orgId = reg.orgId;
      cookies = reg.cookies;

      const analyst = await addMemberToOrg('analyst@assign.com', orgId, Role.ANALYST, 'Analyst');
      analystId = analyst.userId;

      const external = await registerUser('stranger@other.com', 'Other Corp');
      externalUserId = external.userId;
    });

    it('16. should assign an OPEN exception to a valid organization member and transition status to ASSIGNED', async () => {
      const [exc] = await exceptionsRepo.createMany([
        {
          id: 'exc-assign-1',
          organizationId: orgId,
          runId: 'run-1',
          status: ExceptionStatus.OPEN,
        },
      ]);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/exceptions/${exc.id}/assign`)
        .set('Cookie', cookies)
        .send({ assigneeId: analystId });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(ExceptionStatus.ASSIGNED);
      expect(res.body.assigneeId).toBe(analystId);
    });

    it('17. should reassign an already ASSIGNED exception and maintain ASSIGNED status', async () => {
      const [exc] = await exceptionsRepo.createMany([
        {
          id: 'exc-assign-2',
          organizationId: orgId,
          runId: 'run-1',
          status: ExceptionStatus.ASSIGNED,
          assigneeId: analystId,
        },
      ]);

      const member2 = await addMemberToOrg('analyst2@assign.com', orgId, Role.ANALYST, 'Analyst 2');

      const res = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/exceptions/${exc.id}/assign`)
        .set('Cookie', cookies)
        .send({ assigneeId: member2.userId });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(ExceptionStatus.ASSIGNED);
      expect(res.body.assigneeId).toBe(member2.userId);
    });

    it('18. should reassign an UNDER_REVIEW exception and maintain UNDER_REVIEW status', async () => {
      const [exc] = await exceptionsRepo.createMany([
        {
          id: 'exc-assign-3',
          organizationId: orgId,
          runId: 'run-1',
          status: ExceptionStatus.UNDER_REVIEW,
          assigneeId: analystId,
        },
      ]);

      const member2 = await addMemberToOrg('analyst3@assign.com', orgId, Role.ANALYST, 'Analyst 3');

      const res = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/exceptions/${exc.id}/assign`)
        .set('Cookie', cookies)
        .send({ assigneeId: member2.userId });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(ExceptionStatus.UNDER_REVIEW);
      expect(res.body.assigneeId).toBe(member2.userId);
    });

    it('19. should reassign an ESCALATED exception and maintain ESCALATED status', async () => {
      const [exc] = await exceptionsRepo.createMany([
        {
          id: 'exc-assign-4',
          organizationId: orgId,
          runId: 'run-1',
          status: ExceptionStatus.ESCALATED,
          assigneeId: analystId,
        },
      ]);

      const member2 = await addMemberToOrg('analyst4@assign.com', orgId, Role.ANALYST, 'Analyst 4');

      const res = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/exceptions/${exc.id}/assign`)
        .set('Cookie', cookies)
        .send({ assigneeId: member2.userId });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(ExceptionStatus.ESCALATED);
      expect(res.body.assigneeId).toBe(member2.userId);
    });

    it('20. should reject assigning an exception to a non-organization member with 400 Bad Request', async () => {
      const [exc] = await exceptionsRepo.createMany([
        {
          id: 'exc-assign-5',
          organizationId: orgId,
          runId: 'run-1',
          status: ExceptionStatus.OPEN,
        },
      ]);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/exceptions/${exc.id}/assign`)
        .set('Cookie', cookies)
        .send({ assigneeId: externalUserId });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_ASSIGNEE');
    });

    it('21. should reject assigning a RESOLVED exception with 409 Conflict', async () => {
      const [exc] = await exceptionsRepo.createMany([
        {
          id: 'exc-assign-6',
          organizationId: orgId,
          runId: 'run-1',
          status: ExceptionStatus.RESOLVED,
          resolutionReason: 'Done',
          resolutionAction: ResolutionAction.OTHER,
        },
      ]);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/exceptions/${exc.id}/assign`)
        .set('Cookie', cookies)
        .send({ assigneeId: analystId });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_EXCEPTION_TRANSITION');
    });
  });

  describe('5. Finite State Machine Transitions & Resolution', () => {
    let orgId: string;
    let cookies: string[];

    beforeEach(async () => {
      const reg = await registerUser('admin@fsm.com', 'FSM Corp');
      orgId = reg.orgId;
      cookies = reg.cookies;
    });

    it('22. should transition OPEN -> UNDER_REVIEW directly via START_REVIEW', async () => {
      const [exc] = await exceptionsRepo.createMany([
        { id: 'fsm-1', organizationId: orgId, runId: 'run-1', status: ExceptionStatus.OPEN },
      ]);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/exceptions/${exc.id}/status`)
        .set('Cookie', cookies)
        .send({ action: 'START_REVIEW' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(ExceptionStatus.UNDER_REVIEW);
    });

    it('23. should transition ASSIGNED -> UNDER_REVIEW via START_REVIEW', async () => {
      const [exc] = await exceptionsRepo.createMany([
        { id: 'fsm-2', organizationId: orgId, runId: 'run-1', status: ExceptionStatus.ASSIGNED },
      ]);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/exceptions/${exc.id}/status`)
        .set('Cookie', cookies)
        .send({ action: 'START_REVIEW' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(ExceptionStatus.UNDER_REVIEW);
    });

    it('24. should transition ASSIGNED -> ESCALATED via ESCALATE', async () => {
      const [exc] = await exceptionsRepo.createMany([
        { id: 'fsm-3', organizationId: orgId, runId: 'run-1', status: ExceptionStatus.ASSIGNED },
      ]);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/exceptions/${exc.id}/status`)
        .set('Cookie', cookies)
        .send({ action: 'ESCALATE' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(ExceptionStatus.ESCALATED);
    });

    it('25. should transition UNDER_REVIEW -> ESCALATED via ESCALATE', async () => {
      const [exc] = await exceptionsRepo.createMany([
        { id: 'fsm-4', organizationId: orgId, runId: 'run-1', status: ExceptionStatus.UNDER_REVIEW },
      ]);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/exceptions/${exc.id}/status`)
        .set('Cookie', cookies)
        .send({ action: 'ESCALATE' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(ExceptionStatus.ESCALATED);
    });

    it('26. should transition ESCALATED -> UNDER_REVIEW via START_REVIEW', async () => {
      const [exc] = await exceptionsRepo.createMany([
        { id: 'fsm-5', organizationId: orgId, runId: 'run-1', status: ExceptionStatus.ESCALATED },
      ]);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/exceptions/${exc.id}/status`)
        .set('Cookie', cookies)
        .send({ action: 'START_REVIEW' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(ExceptionStatus.UNDER_REVIEW);
    });

    it('27. should transition UNDER_REVIEW -> RESOLVED with valid reason and resolutionAction', async () => {
      const [exc] = await exceptionsRepo.createMany([
        { id: 'fsm-6', organizationId: orgId, runId: 'run-1', status: ExceptionStatus.UNDER_REVIEW },
      ]);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/exceptions/${exc.id}/status`)
        .set('Cookie', cookies)
        .send({
          action: 'RESOLVE',
          resolutionReason: 'Manual check against bank wire trace verified.',
          resolutionAction: ResolutionAction.MANUALLY_RECONCILED,
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(ExceptionStatus.RESOLVED);
      expect(res.body.resolutionReason).toBe('Manual check against bank wire trace verified.');
      expect(res.body.resolutionAction).toBe(ResolutionAction.MANUALLY_RECONCILED);
      expect(res.body.resolvedAt).toBeDefined();
    });

    it('28. should transition ESCALATED -> RESOLVED with valid reason and resolutionAction', async () => {
      const [exc] = await exceptionsRepo.createMany([
        { id: 'fsm-7', organizationId: orgId, runId: 'run-1', status: ExceptionStatus.ESCALATED },
      ]);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/exceptions/${exc.id}/status`)
        .set('Cookie', cookies)
        .send({
          action: 'RESOLVE',
          resolutionReason: 'Approved transaction write-off by financial controller.',
          resolutionAction: ResolutionAction.OTHER,
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(ExceptionStatus.RESOLVED);
      expect(res.body.resolutionReason).toBe(
        'Approved transaction write-off by financial controller.',
      );
      expect(res.body.resolutionAction).toBe(ResolutionAction.OTHER);
    });

    it('29. should reject RESOLVE action if resolutionReason or resolutionAction is omitted (400 Bad Request)', async () => {
      const [exc] = await exceptionsRepo.createMany([
        { id: 'fsm-8', organizationId: orgId, runId: 'run-1', status: ExceptionStatus.UNDER_REVIEW },
      ]);

      // Missing reason and action
      const res = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/exceptions/${exc.id}/status`)
        .set('Cookie', cookies)
        .send({ action: 'RESOLVE' });

      expect(res.status).toBe(400);

      // Short reason (< 5 chars)
      const resShort = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/exceptions/${exc.id}/status`)
        .set('Cookie', cookies)
        .send({
          action: 'RESOLVE',
          resolutionReason: 'ok',
          resolutionAction: ResolutionAction.DATA_CORRECTION,
        });

      expect(resShort.status).toBe(400);
    });

    it('30. should reject forbidden state transitions (e.g. OPEN -> RESOLVED, OPEN -> ESCALATED) with 409 Conflict', async () => {
      const [exc] = await exceptionsRepo.createMany([
        { id: 'fsm-9', organizationId: orgId, runId: 'run-1', status: ExceptionStatus.OPEN },
      ]);

      // Direct OPEN -> RESOLVED forbidden
      const resResolve = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/exceptions/${exc.id}/status`)
        .set('Cookie', cookies)
        .send({
          action: 'RESOLVE',
          resolutionReason: 'Trying to resolve directly without review',
          resolutionAction: ResolutionAction.MANUALLY_RECONCILED,
        });

      expect(resResolve.status).toBe(409);
      expect(resResolve.body.error.code).toBe('INVALID_EXCEPTION_TRANSITION');

      // Direct OPEN -> ESCALATED forbidden
      const resEscalate = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/exceptions/${exc.id}/status`)
        .set('Cookie', cookies)
        .send({ action: 'ESCALATE' });

      expect(resEscalate.status).toBe(409);
      expect(resEscalate.body.error.code).toBe('INVALID_EXCEPTION_TRANSITION');
    });

    it('31. should transition RESOLVED -> OPEN via REOPEN and clear active resolution metadata', async () => {
      const [exc] = await exceptionsRepo.createMany([
        {
          id: 'fsm-10',
          organizationId: orgId,
          runId: 'run-1',
          status: ExceptionStatus.RESOLVED,
          resolutionReason: 'Earlier resolution note',
          resolutionAction: ResolutionAction.CONFIRMED_DUPLICATE,
          resolvedAt: new Date(),
        },
      ]);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/exceptions/${exc.id}/status`)
        .set('Cookie', cookies)
        .send({ action: 'REOPEN' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(ExceptionStatus.OPEN);
      expect(res.body.resolutionReason).toBeNull();
      expect(res.body.resolutionAction).toBeNull();
      expect(res.body.resolvedAt).toBeNull();
    });
  });

  describe('6. Investigation Comments', () => {
    let orgId: string;
    let cookies: string[];
    let excId: string;

    beforeEach(async () => {
      const reg = await registerUser('admin@comments.com', 'Comment Corp');
      orgId = reg.orgId;
      cookies = reg.cookies;

      const [exc] = await exceptionsRepo.createMany([
        { id: 'exc-comm-1', organizationId: orgId, runId: 'run-1', status: ExceptionStatus.OPEN },
      ]);
      excId = exc.id;
    });

    it('32. should add investigation comments and return them in chronological order', async () => {
      const res1 = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/exceptions/${excId}/comments`)
        .set('Cookie', cookies)
        .send({ body: 'First comment: called provider.' });

      expect(res1.status).toBe(201);
      expect(res1.body.body).toBe('First comment: called provider.');

      const res2 = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/exceptions/${excId}/comments`)
        .set('Cookie', cookies)
        .send({ body: 'Second comment: received confirmation document.' });

      expect(res2.status).toBe(201);

      // Verify detail returns comments in order
      const detailRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/exceptions/${excId}`)
        .set('Cookie', cookies);

      expect(detailRes.body.comments.length).toBe(2);
      expect(detailRes.body.comments[0].body).toBe('First comment: called provider.');
      expect(detailRes.body.comments[1].body).toBe(
        'Second comment: received confirmation document.',
      );
    });

    it('33. should reject empty or whitespace-only comments with 400 Bad Request', async () => {
      const resEmpty = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/exceptions/${excId}/comments`)
        .set('Cookie', cookies)
        .send({ body: '' });

      expect(resEmpty.status).toBe(400);

      const resWhitespace = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/exceptions/${excId}/comments`)
        .set('Cookie', cookies)
        .send({ body: '     ' });

      expect(resWhitespace.status).toBe(400);
    });

    it('34. should preserve all comments after exception transitions and reopening', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/exceptions/${excId}/comments`)
        .set('Cookie', cookies)
        .send({ body: 'Audit trail comment before resolution.' });

      // Move to UNDER_REVIEW -> RESOLVE -> REOPEN
      await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/exceptions/${excId}/status`)
        .set('Cookie', cookies)
        .send({ action: 'START_REVIEW' });

      await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/exceptions/${excId}/status`)
        .set('Cookie', cookies)
        .send({
          action: 'RESOLVE',
          resolutionReason: 'Resolved by analyst',
          resolutionAction: ResolutionAction.TRANSACTION_NOT_FOUND,
        });

      await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/exceptions/${excId}/status`)
        .set('Cookie', cookies)
        .send({ action: 'REOPEN' });

      const detailRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/exceptions/${excId}`)
        .set('Cookie', cookies);

      expect(detailRes.body.status).toBe(ExceptionStatus.OPEN);
      expect(detailRes.body.comments.length).toBe(1);
      expect(detailRes.body.comments[0].body).toBe('Audit trail comment before resolution.');
    });
  });

  describe('7. Role-Based Access Control (RBAC)', () => {
    let orgId: string;
    let adminCookies: string[];
    let auditorCookies: string[];
    let excId: string;

    beforeEach(async () => {
      const admin = await registerUser('admin@rbac.com', 'RBAC Corp', Role.ADMIN);
      orgId = admin.orgId;
      adminCookies = admin.cookies;

      const auditor = await addMemberToOrg('auditor@rbac.com', orgId, Role.AUDITOR, 'Auditor');
      auditorCookies = auditor.cookies;

      const [exc] = await exceptionsRepo.createMany([
        { id: 'exc-rbac-1', organizationId: orgId, runId: 'run-1', status: ExceptionStatus.OPEN },
      ]);
      excId = exc.id;
    });

    it('35. should allow AUDITOR role to view exceptions and exception details (read-only)', async () => {
      const listRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/exceptions`)
        .set('Cookie', auditorCookies);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBe(1);

      const detailRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/exceptions/${excId}`)
        .set('Cookie', auditorCookies);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.id).toBe(excId);
    });

    it('36. should forbid AUDITOR role from assigning exceptions (403 Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/exceptions/${excId}/assign`)
        .set('Cookie', auditorCookies)
        .send({ assigneeId: excId });

      expect(res.status).toBe(403);
    });

    it('37. should forbid AUDITOR role from adding comments (403 Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/exceptions/${excId}/comments`)
        .set('Cookie', auditorCookies)
        .send({ body: 'Auditor commentary' });

      expect(res.status).toBe(403);
    });

    it('38. should forbid AUDITOR role from updating exception status (403 Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/exceptions/${excId}/status`)
        .set('Cookie', auditorCookies)
        .send({ action: 'START_REVIEW' });

      expect(res.status).toBe(403);
    });

    it('39. should allow ADMIN role to update exception status (200 OK)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/exceptions/${excId}/status`)
        .set('Cookie', adminCookies)
        .send({ action: 'START_REVIEW' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(ExceptionStatus.UNDER_REVIEW);
    });
  });
});
