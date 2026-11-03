import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSourceStatus, Role } from '@reconcilex/db';
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

describe('Reconciliation Runs & Matches (Phase A6)', () => {
  let app: INestApplication;
  let authRepo: InMemoryAuthRepository;
  let orgRepo: InMemoryOrganizationsRepository;
  let dataSourcesRepo: InMemoryDataSourcesRepository;
  let txnRepo: InMemoryTransactionsRepository;
  let reconciliationRepo: InMemoryReconciliationRepository;

  beforeAll(async () => {
    authRepo = new InMemoryAuthRepository();
    orgRepo = new InMemoryOrganizationsRepository();
    dataSourcesRepo = new InMemoryDataSourcesRepository();
    txnRepo = new InMemoryTransactionsRepository();
    reconciliationRepo = new InMemoryReconciliationRepository(dataSourcesRepo, txnRepo);

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
  });

  // Helper to register user and org
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

  // Helper to seed transactions
  const seedTransactions = async (
    orgId: string,
    dataSourceId: string,
    txns: Array<{
      externalId: string;
      amountMinor: number;
      currency: string;
      transactionDate: string;
      reference?: string;
      status?: string;
    }>,
  ) => {
    return txnRepo.createBatch(
      orgId,
      txns.map((t) => ({
        organizationId: orgId,
        dataSourceId,
        externalId: t.externalId,
        amountMinor: t.amountMinor,
        currency: t.currency,
        transactionDate: new Date(t.transactionDate),
        reference: t.reference || null,
        status: t.status || 'UNMATCHED',
      })),
    );
  };

  describe('Reconciliation Run Creation & Source Validation', () => {
    it('1. should create a run using two valid sources and output PRD-compliant counters', async () => {
      const user = await registerUser('admin@acme.com', 'Acme Corp', Role.ADMIN);
      const sourceA = await createDataSource(user.cookies, user.orgId, 'Internal Orders');
      const sourceB = await createDataSource(user.cookies, user.orgId, 'Stripe Gateway');

      // Seed 2 exact matching pairs + 1 unmatched in A + 1 unmatched in B
      await seedTransactions(user.orgId, sourceA.id, [
        { externalId: 'ORD-1', amountMinor: 10000, currency: 'USD', transactionDate: '2026-10-05', reference: 'REF-100' },
        { externalId: 'ORD-2', amountMinor: 5000, currency: 'USD', transactionDate: '2026-10-10', reference: 'REF-200' },
        { externalId: 'ORD-3', amountMinor: 7500, currency: 'USD', transactionDate: '2026-10-15', reference: 'REF-300' },
      ]);

      await seedTransactions(user.orgId, sourceB.id, [
        { externalId: 'TXN-1', amountMinor: 10000, currency: 'USD', transactionDate: '2026-10-05', reference: 'REF-100' },
        { externalId: 'TXN-2', amountMinor: 5000, currency: 'USD', transactionDate: '2026-10-10', reference: 'REF-200' },
        { externalId: 'TXN-4', amountMinor: 9900, currency: 'USD', transactionDate: '2026-10-20', reference: 'REF-400' },
      ]);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/reconciliation-runs`)
        .set('Cookie', user.cookies)
        .send({
          sourceA: sourceA.id,
          sourceB: sourceB.id,
          dateFrom: '2026-10-01',
          dateTo: '2026-10-31',
          config: {
            dateWindowDays: 3,
            potentialThreshold: 60,
            exactThreshold: 100,
          },
        })
        .expect(HttpStatus.CREATED);

      expect(res.body.jobId).toBeDefined();
      expect(res.body.status).toBe('COMPLETED');
      expect(res.body.run).toBeDefined();
      expect(res.body.run.displayId).toMatch(/^RUN-\d{8}-001$/);
      expect(res.body.run.totalSourceA).toBe(3);
      expect(res.body.run.totalSourceB).toBe(3);
      expect(res.body.run.exactMatchCount).toBe(2);
      expect(res.body.run.potentialMatchCount).toBe(0);
      expect(res.body.run.unmatchedCount).toBe(2);
    });

    it('2. should reject when the same source is selected twice (400 SAME_SOURCE)', async () => {
      const user = await registerUser('admin@acme.com', 'Acme Corp', Role.ADMIN);
      const source = await createDataSource(user.cookies, user.orgId, 'Orders');

      const res = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/reconciliation-runs`)
        .set('Cookie', user.cookies)
        .send({
          sourceA: source.id,
          sourceB: source.id,
          dateFrom: '2026-10-01',
          dateTo: '2026-10-31',
        })
        .expect(HttpStatus.BAD_REQUEST);

      expect(res.body.error.code).toBe('SAME_SOURCE');
    });

    it('3. should reject sources belonging to another organization (404 SOURCE_NOT_FOUND)', async () => {
      const orgA = await registerUser('userA@acme.com', 'Org A');
      const orgB = await registerUser('userB@globex.com', 'Org B');

      const sourceA = await createDataSource(orgA.cookies, orgA.orgId, 'Source A');
      const sourceB = await createDataSource(orgB.cookies, orgB.orgId, 'Source B');

      const res = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgA.orgId}/reconciliation-runs`)
        .set('Cookie', orgA.cookies)
        .send({
          sourceA: sourceA.id,
          sourceB: sourceB.id, // Belonging to Org B!
          dateFrom: '2026-10-01',
          dateTo: '2026-10-31',
        })
        .expect(HttpStatus.NOT_FOUND);

      expect(res.body.error.code).toBe('SOURCE_NOT_FOUND');
    });

    it('4. should reject inactive sources (400 INVALID_SOURCE)', async () => {
      const user = await registerUser('admin@acme.com', 'Acme Corp', Role.ADMIN);
      const sourceA = await createDataSource(user.cookies, user.orgId, 'Source A');
      const sourceB = await createDataSource(user.cookies, user.orgId, 'Source B');

      // Set sourceB to INACTIVE using repository update
      await dataSourcesRepo.update(user.orgId, sourceB.id, { status: DataSourceStatus.INACTIVE });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/reconciliation-runs`)
        .set('Cookie', user.cookies)
        .send({
          sourceA: sourceA.id,
          sourceB: sourceB.id,
          dateFrom: '2026-10-01',
          dateTo: '2026-10-31',
        })
        .expect(HttpStatus.BAD_REQUEST);

      expect(res.body.error.code).toBe('INVALID_SOURCE');
    });

    it('5. should reject invalid date range where dateFrom > dateTo (400 INVALID_DATE_RANGE)', async () => {
      const user = await registerUser('analyst@acme.com', 'Acme Corp');
      const sourceA = await createDataSource(user.cookies, user.orgId, 'Source A');
      const sourceB = await createDataSource(user.cookies, user.orgId, 'Source B');

      const res = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/reconciliation-runs`)
        .set('Cookie', user.cookies)
        .send({
          sourceA: sourceA.id,
          sourceB: sourceB.id,
          dateFrom: '2026-11-01',
          dateTo: '2026-10-01',
        })
        .expect(HttpStatus.BAD_REQUEST);

      expect(res.body.error.code).toBe('INVALID_DATE_RANGE');
    });

    it('6. should filter transactions strictly by date range', async () => {
      const user = await registerUser('analyst@acme.com', 'Acme Corp');
      const sourceA = await createDataSource(user.cookies, user.orgId, 'Source A');
      const sourceB = await createDataSource(user.cookies, user.orgId, 'Source B');

      // Txns in September, October, and November
      await seedTransactions(user.orgId, sourceA.id, [
        { externalId: 'SEP-A', amountMinor: 1000, currency: 'USD', transactionDate: '2026-09-15', reference: 'REF-SEP' },
        { externalId: 'OCT-A', amountMinor: 1000, currency: 'USD', transactionDate: '2026-10-15', reference: 'REF-OCT' },
        { externalId: 'NOV-A', amountMinor: 1000, currency: 'USD', transactionDate: '2026-11-15', reference: 'REF-NOV' },
      ]);

      await seedTransactions(user.orgId, sourceB.id, [
        { externalId: 'SEP-B', amountMinor: 1000, currency: 'USD', transactionDate: '2026-09-15', reference: 'REF-SEP' },
        { externalId: 'OCT-B', amountMinor: 1000, currency: 'USD', transactionDate: '2026-10-15', reference: 'REF-OCT' },
        { externalId: 'NOV-B', amountMinor: 1000, currency: 'USD', transactionDate: '2026-11-15', reference: 'REF-NOV' },
      ]);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/reconciliation-runs`)
        .set('Cookie', user.cookies)
        .send({
          sourceA: sourceA.id,
          sourceB: sourceB.id,
          dateFrom: '2026-10-01',
          dateTo: '2026-10-31',
        })
        .expect(HttpStatus.CREATED);

      expect(res.body.run.totalSourceA).toBe(1);
      expect(res.body.run.totalSourceB).toBe(1);
      expect(res.body.run.exactMatchCount).toBe(1);
    });
  });

  describe('Matching Engine Integration, Persistence & Statuses', () => {
    it('7. should persist exact and potential matches with reasons and update transaction statuses', async () => {
      const user = await registerUser('analyst@acme.com', 'Acme Corp');
      const sourceA = await createDataSource(user.cookies, user.orgId, 'Source A');
      const sourceB = await createDataSource(user.cookies, user.orgId, 'Source B');

      // Txn 1: Exact match (amount 10000, ref 'REF-EXACT', date 2026-10-05)
      // Txn 2: Potential match (same ref 'REF-POTENTIAL', date difference 1 day, amount 5000)
      // Txn 3: Unmatched (currency mismatch or completely different)
      const [txA1, txA2, txA3] = await seedTransactions(user.orgId, sourceA.id, [
        { externalId: 'A-EXACT', amountMinor: 10000, currency: 'USD', transactionDate: '2026-10-05', reference: 'REF-EXACT' },
        { externalId: 'A-POTENTIAL', amountMinor: 5000, currency: 'USD', transactionDate: '2026-10-10', reference: 'REF-POTENTIAL' },
        { externalId: 'A-UNMATCHED', amountMinor: 9999, currency: 'USD', transactionDate: '2026-10-12', reference: 'REF-SOLO-A' },
      ]);

      const [txB1, txB2, txB3] = await seedTransactions(user.orgId, sourceB.id, [
        { externalId: 'B-EXACT', amountMinor: 10000, currency: 'USD', transactionDate: '2026-10-05', reference: 'REF-EXACT' },
        { externalId: 'B-POTENTIAL', amountMinor: 4800, currency: 'USD', transactionDate: '2026-10-11', reference: 'REF-POTENTIAL' },
        { externalId: 'B-UNMATCHED', amountMinor: 8888, currency: 'USD', transactionDate: '2026-10-20', reference: 'REF-SOLO-B' },
      ]);

      const runRes = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/reconciliation-runs`)
        .set('Cookie', user.cookies)
        .send({
          sourceA: sourceA.id,
          sourceB: sourceB.id,
          dateFrom: '2026-10-01',
          dateTo: '2026-10-31',
          config: {
            dateWindowDays: 3,
            potentialThreshold: 60,
            exactThreshold: 100,
          },
        })
        .expect(HttpStatus.CREATED);

      const runId = runRes.body.run.id;
      expect(runRes.body.run.exactMatchCount).toBe(1);
      expect(runRes.body.run.potentialMatchCount).toBe(1);
      expect(runRes.body.run.unmatchedCount).toBe(2);

      // Verify transaction statuses updated
      const updatedA1 = await txnRepo.findById(user.orgId, txA1.id);
      const updatedB1 = await txnRepo.findById(user.orgId, txB1.id);
      expect(updatedA1!.status).toBe('MATCHED');
      expect(updatedB1!.status).toBe('MATCHED');

      const updatedA2 = await txnRepo.findById(user.orgId, txA2.id);
      const updatedB2 = await txnRepo.findById(user.orgId, txB2.id);
      expect(updatedA2!.status).toBe('POTENTIAL_MATCH');
      expect(updatedB2!.status).toBe('POTENTIAL_MATCH');

      const updatedA3 = await txnRepo.findById(user.orgId, txA3.id);
      const updatedB3 = await txnRepo.findById(user.orgId, txB3.id);
      expect(updatedA3!.status).toBe('UNMATCHED');
      expect(updatedB3!.status).toBe('UNMATCHED');

      // Verify matches API returns matches with classification filters
      const exactMatchesRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${user.orgId}/reconciliation-runs/${runId}/matches?classification=EXACT`)
        .set('Cookie', user.cookies)
        .expect(HttpStatus.OK);

      expect(exactMatchesRes.body.data.length).toBe(1);
      expect(exactMatchesRes.body.data[0].classification).toBe('EXACT');
      expect(exactMatchesRes.body.data[0].score).toBe(100);
      expect(exactMatchesRes.body.data[0].status).toBe('CONFIRMED');
      expect(exactMatchesRes.body.data[0].transactionA.externalId).toBe('A-EXACT');
      expect(exactMatchesRes.body.data[0].transactionB.externalId).toBe('B-EXACT');

      const potentialMatchesRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${user.orgId}/reconciliation-runs/${runId}/matches?classification=POTENTIAL`)
        .set('Cookie', user.cookies)
        .expect(HttpStatus.OK);

      expect(potentialMatchesRes.body.data.length).toBe(1);
      expect(potentialMatchesRes.body.data[0].classification).toBe('POTENTIAL');
      expect(potentialMatchesRes.body.data[0].status).toBe('PENDING');

      // Verify unmatched API returns the 2 unmatched transactions
      const unmatchedRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${user.orgId}/reconciliation-runs/${runId}/unmatched`)
        .set('Cookie', user.cookies)
        .expect(HttpStatus.OK);

      expect(unmatchedRes.body.data.length).toBe(2);
      const unmatchedExternalIds = unmatchedRes.body.data.map(
        (t: { externalId: string }) => t.externalId,
      );
      expect(unmatchedExternalIds).toContain('A-UNMATCHED');
      expect(unmatchedExternalIds).toContain('B-UNMATCHED');
    });

    it('8. should prevent double matching of transactions (greedy 1:1)', async () => {
      const user = await registerUser('analyst@acme.com', 'Acme Corp');
      const sourceA = await createDataSource(user.cookies, user.orgId, 'Source A');
      const sourceB = await createDataSource(user.cookies, user.orgId, 'Source B');

      // 1 txn in A, 2 identical candidate txns in B
      await seedTransactions(user.orgId, sourceA.id, [
        { externalId: 'A-SINGLE', amountMinor: 1000, currency: 'USD', transactionDate: '2026-10-05', reference: 'REF-DUP' },
      ]);

      await seedTransactions(user.orgId, sourceB.id, [
        { externalId: 'B-CAND-1', amountMinor: 1000, currency: 'USD', transactionDate: '2026-10-05', reference: 'REF-DUP' },
        { externalId: 'B-CAND-2', amountMinor: 1000, currency: 'USD', transactionDate: '2026-10-05', reference: 'REF-DUP' },
      ]);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/reconciliation-runs`)
        .set('Cookie', user.cookies)
        .send({
          sourceA: sourceA.id,
          sourceB: sourceB.id,
          dateFrom: '2026-10-01',
          dateTo: '2026-10-31',
        })
        .expect(HttpStatus.CREATED);

      expect(res.body.run.exactMatchCount).toBe(1);
      expect(res.body.run.unmatchedCount).toBe(1); // 1 unmatched remaining in B
    });
  });

  describe('Idempotency & Duplicate Active Run Prevention', () => {
    it('9. should return existing run on duplicate Idempotency-Key with matching parameters', async () => {
      const user = await registerUser('analyst@acme.com', 'Acme Corp');
      const sourceA = await createDataSource(user.cookies, user.orgId, 'Source A');
      const sourceB = await createDataSource(user.cookies, user.orgId, 'Source B');

      const idempotencyKey = 'req-key-12345';

      const res1 = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/reconciliation-runs`)
        .set('Cookie', user.cookies)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          sourceA: sourceA.id,
          sourceB: sourceB.id,
          dateFrom: '2026-10-01',
          dateTo: '2026-10-31',
        })
        .expect(HttpStatus.CREATED);

      const res2 = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/reconciliation-runs`)
        .set('Cookie', user.cookies)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          sourceA: sourceA.id,
          sourceB: sourceB.id,
          dateFrom: '2026-10-01',
          dateTo: '2026-10-31',
        })
        .expect(HttpStatus.CREATED);

      expect(res2.body.run.id).toBe(res1.body.run.id);
      expect(res2.body.run.displayId).toBe(res1.body.run.displayId);
    });

    it('10. should reject with 409 IDEMPOTENCY_CONFLICT when Idempotency-Key is reused with different parameters', async () => {
      const user = await registerUser('analyst@acme.com', 'Acme Corp');
      const sourceA = await createDataSource(user.cookies, user.orgId, 'Source A');
      const sourceB = await createDataSource(user.cookies, user.orgId, 'Source B');

      const idempotencyKey = 'conflict-key-999';

      await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/reconciliation-runs`)
        .set('Cookie', user.cookies)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          sourceA: sourceA.id,
          sourceB: sourceB.id,
          dateFrom: '2026-10-01',
          dateTo: '2026-10-31',
        })
        .expect(HttpStatus.CREATED);

      const res2 = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/reconciliation-runs`)
        .set('Cookie', user.cookies)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          sourceA: sourceA.id,
          sourceB: sourceB.id,
          dateFrom: '2026-11-01', // Changed date!
          dateTo: '2026-11-30',
        })
        .expect(HttpStatus.CONFLICT);

      expect(res2.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
    });

    it('11. should reject concurrent active runs for the same source pair (409 RUN_ALREADY_PROCESSING)', async () => {
      const user = await registerUser('analyst@acme.com', 'Acme Corp');
      const sourceA = await createDataSource(user.cookies, user.orgId, 'Source A');
      const sourceB = await createDataSource(user.cookies, user.orgId, 'Source B');

      // Create an active (PROCESSING) run for this source pair
      await reconciliationRepo.createRun({
        organizationId: user.orgId,
        displayId: 'RUN-20261103-999',
        sourceAId: sourceA.id,
        sourceBId: sourceB.id,
        status: 'PROCESSING',
        config: {},
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/reconciliation-runs`)
        .set('Cookie', user.cookies)
        .send({
          sourceA: sourceA.id,
          sourceB: sourceB.id,
          dateFrom: '2026-10-01',
          dateTo: '2026-10-31',
        })
        .expect(HttpStatus.CONFLICT);

      expect(res.body.error.code).toBe('RUN_ALREADY_PROCESSING');
    });
  });

  describe('Read APIs: List Runs, Detail, Matches & Unmatched', () => {
    it('12. should retrieve run details and list runs with pagination and filters', async () => {
      const user = await registerUser('analyst@acme.com', 'Acme Corp');
      const sourceA = await createDataSource(user.cookies, user.orgId, 'Source A');
      const sourceB = await createDataSource(user.cookies, user.orgId, 'Source B');

      const createRes = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/reconciliation-runs`)
        .set('Cookie', user.cookies)
        .send({
          sourceA: sourceA.id,
          sourceB: sourceB.id,
          dateFrom: '2026-10-01',
          dateTo: '2026-10-31',
        })
        .expect(HttpStatus.CREATED);

      const runId = createRes.body.run.id;

      // Detail
      const detailRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${user.orgId}/reconciliation-runs/${runId}`)
        .set('Cookie', user.cookies)
        .expect(HttpStatus.OK);

      expect(detailRes.body.id).toBe(runId);
      expect(detailRes.body.sourceA.name).toBe('Source A');
      expect(detailRes.body.sourceB.name).toBe('Source B');
      expect(detailRes.body.config).toBeDefined();

      // List
      const listRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${user.orgId}/reconciliation-runs?status=COMPLETED&limit=10`)
        .set('Cookie', user.cookies)
        .expect(HttpStatus.OK);

      expect(listRes.body.data.length).toBe(1);
      expect(listRes.body.total).toBe(1);
    });
  });

  describe('Confirm & Reject Potential Matches', () => {
    it('13. should confirm a potential match and promote transactions to MATCHED', async () => {
      const user = await registerUser('analyst@acme.com', 'Acme Corp');
      const sourceA = await createDataSource(user.cookies, user.orgId, 'Source A');
      const sourceB = await createDataSource(user.cookies, user.orgId, 'Source B');

      // Seed potential match
      const [txA] = await seedTransactions(user.orgId, sourceA.id, [
        { externalId: 'POT-A', amountMinor: 5000, currency: 'USD', transactionDate: '2026-10-10', reference: 'REF-POT' },
      ]);
      const [txB] = await seedTransactions(user.orgId, sourceB.id, [
        { externalId: 'POT-B', amountMinor: 4800, currency: 'USD', transactionDate: '2026-10-11', reference: 'REF-POT' },
      ]);

      const runRes = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/reconciliation-runs`)
        .set('Cookie', user.cookies)
        .send({
          sourceA: sourceA.id,
          sourceB: sourceB.id,
          dateFrom: '2026-10-01',
          dateTo: '2026-10-31',
        });

      const matchesRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${user.orgId}/reconciliation-runs/${runRes.body.run.id}/matches?classification=POTENTIAL`)
        .set('Cookie', user.cookies);

      const matchId = matchesRes.body.data[0].id;

      // Confirm
      const confirmRes = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/matches/${matchId}/confirm`)
        .set('Cookie', user.cookies)
        .expect(HttpStatus.OK);

      expect(confirmRes.body.status).toBe('CONFIRMED');
      expect(confirmRes.body.confirmedBy).toBe(user.userId);
      expect(confirmRes.body.confirmedAt).toBeDefined();

      // Check transactions updated
      const updatedA = await txnRepo.findById(user.orgId, txA.id);
      const updatedB = await txnRepo.findById(user.orgId, txB.id);
      expect(updatedA!.status).toBe('MATCHED');
      expect(updatedB!.status).toBe('MATCHED');
    });

    it('14. should reject confirmation of an already confirmed match (409 MATCH_ALREADY_CONFIRMED)', async () => {
      const user = await registerUser('analyst@acme.com', 'Acme Corp');
      const sourceA = await createDataSource(user.cookies, user.orgId, 'Source A');
      const sourceB = await createDataSource(user.cookies, user.orgId, 'Source B');

      await seedTransactions(user.orgId, sourceA.id, [
        { externalId: 'POT-A', amountMinor: 5000, currency: 'USD', transactionDate: '2026-10-10', reference: 'REF-POT' },
      ]);
      await seedTransactions(user.orgId, sourceB.id, [
        { externalId: 'POT-B', amountMinor: 4800, currency: 'USD', transactionDate: '2026-10-11', reference: 'REF-POT' },
      ]);

      const runRes = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/reconciliation-runs`)
        .set('Cookie', user.cookies)
        .send({
          sourceA: sourceA.id,
          sourceB: sourceB.id,
          dateFrom: '2026-10-01',
          dateTo: '2026-10-31',
        });

      const matchesRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${user.orgId}/reconciliation-runs/${runRes.body.run.id}/matches?classification=POTENTIAL`)
        .set('Cookie', user.cookies);

      const matchId = matchesRes.body.data[0].id;

      // First confirmation succeeds
      await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/matches/${matchId}/confirm`)
        .set('Cookie', user.cookies)
        .expect(HttpStatus.OK);

      // Second confirmation fails
      const res2 = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/matches/${matchId}/confirm`)
        .set('Cookie', user.cookies)
        .expect(HttpStatus.CONFLICT);

      expect(res2.body.error.code).toBe('MATCH_ALREADY_CONFIRMED');
    });

    it('15. should reject a potential match, record reason, and recalculate transaction statuses to UNMATCHED', async () => {
      const user = await registerUser('analyst@acme.com', 'Acme Corp');
      const sourceA = await createDataSource(user.cookies, user.orgId, 'Source A');
      const sourceB = await createDataSource(user.cookies, user.orgId, 'Source B');

      const [txA] = await seedTransactions(user.orgId, sourceA.id, [
        { externalId: 'POT-A', amountMinor: 5000, currency: 'USD', transactionDate: '2026-10-10', reference: 'REF-POT' },
      ]);
      const [txB] = await seedTransactions(user.orgId, sourceB.id, [
        { externalId: 'POT-B', amountMinor: 4800, currency: 'USD', transactionDate: '2026-10-11', reference: 'REF-POT' },
      ]);

      const runRes = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/reconciliation-runs`)
        .set('Cookie', user.cookies)
        .send({
          sourceA: sourceA.id,
          sourceB: sourceB.id,
          dateFrom: '2026-10-01',
          dateTo: '2026-10-31',
        });

      const matchesRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${user.orgId}/reconciliation-runs/${runRes.body.run.id}/matches?classification=POTENTIAL`)
        .set('Cookie', user.cookies);

      const matchId = matchesRes.body.data[0].id;

      // Reject
      const rejectRes = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/matches/${matchId}/reject`)
        .set('Cookie', user.cookies)
        .send({ reason: 'Transaction references do not represent the same payment.' })
        .expect(HttpStatus.OK);

      expect(rejectRes.body.status).toBe('REJECTED');
      expect(rejectRes.body.rejectedBy).toBe(user.userId);
      expect(rejectRes.body.rejectedAt).toBeDefined();

      // Recalculated statuses
      const updatedA = await txnRepo.findById(user.orgId, txA.id);
      const updatedB = await txnRepo.findById(user.orgId, txB.id);
      expect(updatedA!.status).toBe('UNMATCHED');
      expect(updatedB!.status).toBe('UNMATCHED');

      // Distinction preserved: rejected candidates are not in the run's unmatched API
      const unmatchedRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${user.orgId}/reconciliation-runs/${runRes.body.run.id}/unmatched`)
        .set('Cookie', user.cookies);

      const unmatchedExternalIds = unmatchedRes.body.data.map(
        (t: { externalId: string }) => t.externalId,
      );
      expect(unmatchedExternalIds).not.toContain('POT-A');
      expect(unmatchedExternalIds).not.toContain('POT-B');
    });

    it('16. should reject confirmation of a rejected match (409 MATCH_ALREADY_REJECTED)', async () => {
      const user = await registerUser('analyst@acme.com', 'Acme Corp');
      const sourceA = await createDataSource(user.cookies, user.orgId, 'Source A');
      const sourceB = await createDataSource(user.cookies, user.orgId, 'Source B');

      await seedTransactions(user.orgId, sourceA.id, [
        { externalId: 'POT-A', amountMinor: 5000, currency: 'USD', transactionDate: '2026-10-10', reference: 'REF-POT' },
      ]);
      await seedTransactions(user.orgId, sourceB.id, [
        { externalId: 'POT-B', amountMinor: 4800, currency: 'USD', transactionDate: '2026-10-11', reference: 'REF-POT' },
      ]);

      const runRes = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/reconciliation-runs`)
        .set('Cookie', user.cookies)
        .send({
          sourceA: sourceA.id,
          sourceB: sourceB.id,
          dateFrom: '2026-10-01',
          dateTo: '2026-10-31',
        });

      const matchesRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${user.orgId}/reconciliation-runs/${runRes.body.run.id}/matches?classification=POTENTIAL`)
        .set('Cookie', user.cookies);

      const matchId = matchesRes.body.data[0].id;

      // Reject first
      await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/matches/${matchId}/reject`)
        .set('Cookie', user.cookies)
        .expect(HttpStatus.OK);

      // Attempt confirm
      const res = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/matches/${matchId}/confirm`)
        .set('Cookie', user.cookies)
        .expect(HttpStatus.CONFLICT);

      expect(res.body.error.code).toBe('MATCH_ALREADY_REJECTED');
    });

    it('17. should reject confirming an EXACT match (400 INVALID_MATCH_STATE)', async () => {
      const user = await registerUser('analyst@acme.com', 'Acme Corp');
      const sourceA = await createDataSource(user.cookies, user.orgId, 'Source A');
      const sourceB = await createDataSource(user.cookies, user.orgId, 'Source B');

      await seedTransactions(user.orgId, sourceA.id, [
        { externalId: 'EX-A', amountMinor: 1000, currency: 'USD', transactionDate: '2026-10-10', reference: 'REF-EX' },
      ]);
      await seedTransactions(user.orgId, sourceB.id, [
        { externalId: 'EX-B', amountMinor: 1000, currency: 'USD', transactionDate: '2026-10-10', reference: 'REF-EX' },
      ]);

      const runRes = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/reconciliation-runs`)
        .set('Cookie', user.cookies)
        .send({
          sourceA: sourceA.id,
          sourceB: sourceB.id,
          dateFrom: '2026-10-01',
          dateTo: '2026-10-31',
        });

      const matchesRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${user.orgId}/reconciliation-runs/${runRes.body.run.id}/matches?classification=EXACT`)
        .set('Cookie', user.cookies);

      const exactMatchId = matchesRes.body.data[0].id;

      const res = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/matches/${exactMatchId}/confirm`)
        .set('Cookie', user.cookies)
        .expect(HttpStatus.BAD_REQUEST);

      expect(res.body.error.code).toBe('INVALID_MATCH_STATE');
    });

    it('18. should reject confirming if a transaction in the match is already MATCHED (409 TRANSACTION_ALREADY_MATCHED)', async () => {
      const user = await registerUser('analyst@acme.com', 'Acme Corp');
      const sourceA = await createDataSource(user.cookies, user.orgId, 'Source A');
      const sourceB = await createDataSource(user.cookies, user.orgId, 'Source B');

      const [txA] = await seedTransactions(user.orgId, sourceA.id, [
        { externalId: 'POT-A', amountMinor: 5000, currency: 'USD', transactionDate: '2026-10-10', reference: 'REF-POT' },
      ]);
      await seedTransactions(user.orgId, sourceB.id, [
        { externalId: 'POT-B', amountMinor: 4800, currency: 'USD', transactionDate: '2026-10-11', reference: 'REF-POT' },
      ]);

      const runRes = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/reconciliation-runs`)
        .set('Cookie', user.cookies)
        .send({
          sourceA: sourceA.id,
          sourceB: sourceB.id,
          dateFrom: '2026-10-01',
          dateTo: '2026-10-31',
        });

      const matchesRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${user.orgId}/reconciliation-runs/${runRes.body.run.id}/matches?classification=POTENTIAL`)
        .set('Cookie', user.cookies);

      const matchId = matchesRes.body.data[0].id;

      // Simulate transaction A having already been matched in another operation
      await txnRepo.updateStatuses(user.orgId, [txA.id], 'MATCHED');

      const res = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/matches/${matchId}/confirm`)
        .set('Cookie', user.cookies)
        .expect(HttpStatus.CONFLICT);

      expect(res.body.error.code).toBe('TRANSACTION_ALREADY_MATCHED');
    });

    it('18b. should safely handle concurrent confirmation requests (one succeeds 200, one gets 409)', async () => {
      const user = await registerUser('analyst@acme.com', 'Acme Corp');
      const sourceA = await createDataSource(user.cookies, user.orgId, 'Source A');
      const sourceB = await createDataSource(user.cookies, user.orgId, 'Source B');

      await seedTransactions(user.orgId, sourceA.id, [
        { externalId: 'CONCUR-A', amountMinor: 5000, currency: 'USD', transactionDate: '2026-10-10', reference: 'REF-CONCUR' },
      ]);
      await seedTransactions(user.orgId, sourceB.id, [
        { externalId: 'CONCUR-B', amountMinor: 4800, currency: 'USD', transactionDate: '2026-10-11', reference: 'REF-CONCUR' },
      ]);

      const runRes = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/reconciliation-runs`)
        .set('Cookie', user.cookies)
        .send({
          sourceA: sourceA.id,
          sourceB: sourceB.id,
          dateFrom: '2026-10-01',
          dateTo: '2026-10-31',
        });

      const matchesRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${user.orgId}/reconciliation-runs/${runRes.body.run.id}/matches?classification=POTENTIAL`)
        .set('Cookie', user.cookies);

      const matchId = matchesRes.body.data[0].id;

      // Execute concurrent confirm requests
      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post(`/api/v1/orgs/${user.orgId}/matches/${matchId}/confirm`)
          .set('Cookie', user.cookies),
        request(app.getHttpServer())
          .post(`/api/v1/orgs/${user.orgId}/matches/${matchId}/confirm`)
          .set('Cookie', user.cookies),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([HttpStatus.OK, HttpStatus.CONFLICT]);

      const conflictRes = res1.status === HttpStatus.CONFLICT ? res1 : res2;
      expect(conflictRes.body.error.code).toBe('MATCH_ALREADY_CONFIRMED');
    });
  });

  describe('Multi-Tenant Isolation & Role-Based Access Control', () => {
    it('19. should return 404 when Org A attempts to access Org B run or matches (IDOR prevention)', async () => {
      const orgA = await registerUser('userA@acme.com', 'Org A');
      const orgB = await registerUser('userB@globex.com', 'Org B');

      const sourceA = await createDataSource(orgA.cookies, orgA.orgId, 'Source A');
      const sourceB = await createDataSource(orgA.cookies, orgA.orgId, 'Source B');

      const runRes = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgA.orgId}/reconciliation-runs`)
        .set('Cookie', orgA.cookies)
        .send({
          sourceA: sourceA.id,
          sourceB: sourceB.id,
          dateFrom: '2026-10-01',
          dateTo: '2026-10-31',
        });

      const runId = runRes.body.run.id;

      // User from Org B attempts to access Org A run
      await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgA.orgId}/reconciliation-runs/${runId}`)
        .set('Cookie', orgB.cookies)
        .expect(HttpStatus.NOT_FOUND);

      // User from Org B attempts to list matches of Org A run
      await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgA.orgId}/reconciliation-runs/${runId}/matches`)
        .set('Cookie', orgB.cookies)
        .expect(HttpStatus.NOT_FOUND);
    });

    it('20. should forbid AUDITOR role from creating runs, confirming, or rejecting matches (403 Forbidden)', async () => {
      const admin = await registerUser('admin@acme.com', 'Acme Corp', Role.ADMIN);
      const auditor = await registerUser('auditor@acme.com', 'Acme Corp 2', Role.AUDITOR);

      // Add auditor membership to admin's organization
      orgRepo.memberships.set(`m-${auditor.userId}-${admin.orgId}`, {
        id: `m-${auditor.userId}-${admin.orgId}`,
        userId: auditor.userId,
        organizationId: admin.orgId,
        role: Role.AUDITOR,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const sourceA = await createDataSource(admin.cookies, admin.orgId, 'Source A');
      const sourceB = await createDataSource(admin.cookies, admin.orgId, 'Source B');

      // Auditor cannot create runs in admin's organization
      await request(app.getHttpServer())
        .post(`/api/v1/orgs/${admin.orgId}/reconciliation-runs`)
        .set('Cookie', auditor.cookies)
        .send({
          sourceA: sourceA.id,
          sourceB: sourceB.id,
          dateFrom: '2026-10-01',
          dateTo: '2026-10-31',
        })
        .expect(HttpStatus.FORBIDDEN);

      // Admin creates a run with potential match
      await seedTransactions(admin.orgId, sourceA.id, [
        { externalId: 'POT-A', amountMinor: 5000, currency: 'USD', transactionDate: '2026-10-10', reference: 'REF-POT' },
      ]);
      await seedTransactions(admin.orgId, sourceB.id, [
        { externalId: 'POT-B', amountMinor: 4800, currency: 'USD', transactionDate: '2026-10-11', reference: 'REF-POT' },
      ]);

      const runRes = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${admin.orgId}/reconciliation-runs`)
        .set('Cookie', admin.cookies)
        .send({
          sourceA: sourceA.id,
          sourceB: sourceB.id,
          dateFrom: '2026-10-01',
          dateTo: '2026-10-31',
        });

      const matchesRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${admin.orgId}/reconciliation-runs/${runRes.body.run.id}/matches`)
        .set('Cookie', admin.cookies);

      const matchId = matchesRes.body.data[0].id;

      // Auditor can READ matches (200 OK)
      await request(app.getHttpServer())
        .get(`/api/v1/orgs/${admin.orgId}/reconciliation-runs/${runRes.body.run.id}/matches`)
        .set('Cookie', auditor.cookies)
        .expect(HttpStatus.OK);

      // Auditor CANNOT confirm match (403 Forbidden)
      await request(app.getHttpServer())
        .post(`/api/v1/orgs/${admin.orgId}/matches/${matchId}/confirm`)
        .set('Cookie', auditor.cookies)
        .expect(HttpStatus.FORBIDDEN);

      // Auditor CANNOT reject match (403 Forbidden)
      await request(app.getHttpServer())
        .post(`/api/v1/orgs/${admin.orgId}/matches/${matchId}/reject`)
        .set('Cookie', auditor.cookies)
        .send({ reason: 'Audit rejection' })
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  describe('Edge Cases', () => {
    it('21. should handle empty source transactions gracefully (0 totals and 0 matches)', async () => {
      const user = await registerUser('analyst@acme.com', 'Acme Corp');
      const sourceA = await createDataSource(user.cookies, user.orgId, 'Source A');
      const sourceB = await createDataSource(user.cookies, user.orgId, 'Source B');

      const res = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/reconciliation-runs`)
        .set('Cookie', user.cookies)
        .send({
          sourceA: sourceA.id,
          sourceB: sourceB.id,
          dateFrom: '2026-10-01',
          dateTo: '2026-10-31',
        })
        .expect(HttpStatus.CREATED);

      expect(res.body.run.totalSourceA).toBe(0);
      expect(res.body.run.totalSourceB).toBe(0);
      expect(res.body.run.exactMatchCount).toBe(0);
      expect(res.body.run.potentialMatchCount).toBe(0);
      expect(res.body.run.unmatchedCount).toBe(0);
    });

    it('22. should handle competing potential matches for the same transaction correctly', async () => {
      const user = await registerUser('analyst@acme.com', 'Acme Corp');
      const sourceA = await createDataSource(user.cookies, user.orgId, 'Source A');
      const sourceB = await createDataSource(user.cookies, user.orgId, 'Source B');

      // Create 2 potential matches involving txA manually or via run
      const [txA] = await seedTransactions(user.orgId, sourceA.id, [
        { externalId: 'COMPETE-A', amountMinor: 5000, currency: 'USD', transactionDate: '2026-10-10', reference: 'REF-COMP' },
      ]);
      const [txB1, txB2] = await seedTransactions(user.orgId, sourceB.id, [
        { externalId: 'COMPETE-B1', amountMinor: 4900, currency: 'USD', transactionDate: '2026-10-11', reference: 'REF-COMP' },
        { externalId: 'COMPETE-B2', amountMinor: 4800, currency: 'USD', transactionDate: '2026-10-12', reference: 'REF-COMP' },
      ]);

      const run = await reconciliationRepo.createRun({
        organizationId: user.orgId,
        displayId: 'RUN-20261103-010',
        sourceAId: sourceA.id,
        sourceBId: sourceB.id,
        status: 'COMPLETED',
        config: {},
      });

      const [m1, m2] = await reconciliationRepo.createMatches([
        {
          organizationId: user.orgId,
          runId: run.id,
          transactionAId: txA.id,
          transactionBId: txB1.id,
          classification: 'POTENTIAL',
          score: 75,
          reasons: { score: 75 },
          status: 'PENDING',
        },
        {
          organizationId: user.orgId,
          runId: run.id,
          transactionAId: txA.id,
          transactionBId: txB2.id,
          classification: 'POTENTIAL',
          score: 65,
          reasons: { score: 65 },
          status: 'PENDING',
        },
      ]);

      await txnRepo.updateStatuses(user.orgId, [txA.id, txB1.id, txB2.id], 'POTENTIAL_MATCH');

      // Reject m1
      await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/matches/${m1.id}/reject`)
        .set('Cookie', user.cookies)
        .expect(HttpStatus.OK);

      // Important rule check: transaction A should STILL be POTENTIAL_MATCH because m2 is still pending!
      const updatedA = await txnRepo.findById(user.orgId, txA.id);
      expect(updatedA!.status).toBe('POTENTIAL_MATCH');

      // txB1 had only m1, so it should be UNMATCHED now
      const updatedB1 = await txnRepo.findById(user.orgId, txB1.id);
      expect(updatedB1!.status).toBe('UNMATCHED');

      // Confirm m2
      await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/matches/${m2.id}/confirm`)
        .set('Cookie', user.cookies)
        .expect(HttpStatus.OK);

      // Now txA and txB2 are MATCHED
      const finalA = await txnRepo.findById(user.orgId, txA.id);
      const finalB2 = await txnRepo.findById(user.orgId, txB2.id);
      expect(finalA!.status).toBe('MATCHED');
      expect(finalB2!.status).toBe('MATCHED');
    });
  });
});
