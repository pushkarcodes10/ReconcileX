import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AuditAction,
  AuditEntityType,
  ExceptionStatus,
  JobStatus,
  JobType,
  ResolutionAction,
  Role,
} from '@reconcilex/db';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { OrgGuard } from '../src/common/guards/org.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { RequestIdMiddleware } from '../src/common/middleware/request-id.middleware';
import configuration from '../src/config/configuration';
import { AuditController } from '../src/modules/audit/audit.controller';
import { AuditService } from '../src/modules/audit/audit.service';
import { AUDIT_REPOSITORY } from '../src/modules/audit/repositories/audit.repository.interface';
import { InMemoryAuditRepository } from '../src/modules/audit/repositories/in-memory-audit.repository';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { PasswordService } from '../src/modules/auth/password.service';
import { AUTH_REPOSITORY } from '../src/modules/auth/repositories/auth.repository.interface';
import { InMemoryAuthRepository } from '../src/modules/auth/repositories/in-memory-auth.repository';
import { TokenService } from '../src/modules/auth/token.service';
import { DashboardController } from '../src/modules/dashboard/dashboard.controller';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';
import { DASHBOARD_REPOSITORY } from '../src/modules/dashboard/repositories/dashboard.repository.interface';
import { InMemoryDashboardRepository } from '../src/modules/dashboard/repositories/in-memory-dashboard.repository';
import { DataSourcesController } from '../src/modules/data-sources/data-sources.controller';
import { DataSourcesService } from '../src/modules/data-sources/data-sources.service';
import { DATA_SOURCES_REPOSITORY } from '../src/modules/data-sources/repositories/data-sources.repository.interface';
import { InMemoryDataSourcesRepository } from '../src/modules/data-sources/repositories/in-memory-data-sources.repository';
import { ExceptionsController } from '../src/modules/exceptions/exceptions.controller';
import { ExceptionsService } from '../src/modules/exceptions/exceptions.service';
import { EXCEPTIONS_REPOSITORY } from '../src/modules/exceptions/repositories/exceptions.repository.interface';
import { InMemoryExceptionsRepository } from '../src/modules/exceptions/repositories/in-memory-exceptions.repository';
import { JobsController } from '../src/modules/jobs/jobs.controller';
import { JobsService } from '../src/modules/jobs/jobs.service';
import { JOBS_REPOSITORY } from '../src/modules/jobs/repositories/jobs.repository.interface';
import { InMemoryJobsRepository } from '../src/modules/jobs/repositories/in-memory-jobs.repository';
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

describe('Phase A8: Audit Logs, Dashboard & Job Status Tracking', () => {
  let app: INestApplication;
  let authRepo: InMemoryAuthRepository;
  let orgRepo: InMemoryOrganizationsRepository;
  let dataSourcesRepo: InMemoryDataSourcesRepository;
  let txnRepo: InMemoryTransactionsRepository;
  let reconciliationRepo: InMemoryReconciliationRepository;
  let exceptionsRepo: InMemoryExceptionsRepository;
  let auditRepo: InMemoryAuditRepository;
  let jobsRepo: InMemoryJobsRepository;
  let dashboardRepo: InMemoryDashboardRepository;

  let auditService: AuditService;
  let jobsService: JobsService;

  beforeAll(async () => {
    authRepo = new InMemoryAuthRepository();
    orgRepo = new InMemoryOrganizationsRepository();
    dataSourcesRepo = new InMemoryDataSourcesRepository();
    txnRepo = new InMemoryTransactionsRepository();
    reconciliationRepo = new InMemoryReconciliationRepository(dataSourcesRepo, txnRepo);
    exceptionsRepo = new InMemoryExceptionsRepository(authRepo, reconciliationRepo, txnRepo);
    auditRepo = new InMemoryAuditRepository(authRepo);
    jobsRepo = new InMemoryJobsRepository();
    dashboardRepo = new InMemoryDashboardRepository(
      txnRepo,
      reconciliationRepo,
      exceptionsRepo,
      authRepo,
    );

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
        AuditController,
        JobsController,
        DashboardController,
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
        AuditService,
        JobsService,
        DashboardService,
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
        {
          provide: AUDIT_REPOSITORY,
          useValue: auditRepo,
        },
        {
          provide: JOBS_REPOSITORY,
          useValue: jobsRepo,
        },
        {
          provide: DASHBOARD_REPOSITORY,
          useValue: dashboardRepo,
        },
      ],
    }).compile();

    auditService = moduleFixture.get<AuditService>(AuditService);
    jobsService = moduleFixture.get<JobsService>(JobsService);

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
    auditRepo.clear();
    jobsRepo.clear();
  });

  // Helpers
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

  const addMemberToOrg = async (
    email: string,
    orgId: string,
    role: Role = Role.ANALYST,
    name: string = 'Member User',
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

  const createDataSource = async (cookies: string[], orgId: string, name: string) => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/orgs/${orgId}/data-sources`)
      .set('Cookie', cookies)
      .send({
        name,
        type: 'BANK',
        columnMapping: {
          external_id: 'txn_id',
          amount: 'amount',
          date: 'date',
          currency: 'currency',
          reference: 'ref',
        },
      });
    return res.body;
  };

  describe('1. Audit Logs Read APIs & Multi-Tenancy / RBAC', () => {
    it('should list audit logs with pagination and verify structure', async () => {
      const { cookies, orgId, userId } = await registerUser('auditor1@example.com', 'Audit Corp');

      await auditService.logUserAction(
        orgId,
        userId,
        AuditAction.RECONCILIATION_RUN_CREATED,
        AuditEntityType.RECONCILIATION_RUN,
        'run-1',
        { displayId: 'RUN-1' },
      );
      await auditService.logUserAction(
        orgId,
        userId,
        AuditAction.MATCH_CONFIRMED,
        AuditEntityType.MATCH,
        'match-1',
      );

      const res = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/audit-logs`)
        .set('Cookie', cookies);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.length).toBe(2);
      expect(res.body.meta).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      });

      const firstItem = res.body.data[0];
      expect(firstItem.id).toBeDefined();
      expect(firstItem.organizationId).toBe(orgId);
      expect(firstItem.action).toBe(AuditAction.MATCH_CONFIRMED);
      expect(firstItem.actor).toBeDefined();
    });

    it('should filter audit logs by action, entityType, and actorId', async () => {
      const { cookies, orgId, userId } = await registerUser('auditor2@example.com', 'Filter Corp');

      await auditService.logUserAction(
        orgId,
        userId,
        AuditAction.MATCH_CONFIRMED,
        AuditEntityType.MATCH,
        'match-1',
      );
      await auditService.logUserAction(
        orgId,
        userId,
        AuditAction.MATCH_REJECTED,
        AuditEntityType.MATCH,
        'match-2',
      );
      await auditService.logSystemAction(
        orgId,
        AuditAction.EXCEPTION_CREATED,
        AuditEntityType.EXCEPTION,
        'exc-1',
      );

      // Filter by action
      const actionRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/audit-logs?action=${AuditAction.MATCH_CONFIRMED}`)
        .set('Cookie', cookies);

      expect(actionRes.status).toBe(200);
      expect(actionRes.body.meta.total).toBe(1);
      expect(actionRes.body.data[0].action).toBe(AuditAction.MATCH_CONFIRMED);

      // Filter by entityType
      const entityRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/audit-logs?entityType=${AuditEntityType.MATCH}`)
        .set('Cookie', cookies);

      expect(entityRes.status).toBe(200);
      expect(entityRes.body.meta.total).toBe(2);

      // Filter by actorId
      const actorRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/audit-logs?actorId=${userId}`)
        .set('Cookie', cookies);

      expect(actorRes.status).toBe(200);
      expect(actorRes.body.meta.total).toBe(2);
    });

    it('should retrieve single audit log detail by ID', async () => {
      const { cookies, orgId, userId } = await registerUser('detail@example.com', 'Detail Corp');

      const log = await auditService.logUserAction(
        orgId,
        userId,
        AuditAction.EXCEPTION_RESOLVED,
        AuditEntityType.EXCEPTION,
        'exc-99',
        { reason: 'Duplicate entry detected' },
      );

      const res = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/audit-logs/${log.id}`)
        .set('Cookie', cookies);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(log.id);
      expect(res.body.action).toBe(AuditAction.EXCEPTION_RESOLVED);
      expect(res.body.metadata.reason).toBe('Duplicate entry detected');
      expect(res.body.actor.id).toBe(userId);
    });

    it('should prevent cross-tenant access to audit logs (IDOR protection returns 404)', async () => {
      const { cookies: _cookiesA, orgId: orgA, userId: userA } = await registerUser(
        'orgA@example.com',
        'Org A',
      );
      const { cookies: cookiesB, orgId: orgB } = await registerUser('orgB@example.com', 'Org B');

      const logA = await auditService.logUserAction(
        orgA,
        userA,
        AuditAction.RECONCILIATION_RUN_CREATED,
        AuditEntityType.RECONCILIATION_RUN,
        'run-A',
      );

      // User from Org B attempts to read log from Org A
      const res = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgB}/audit-logs/${logA.id}`)
        .set('Cookie', cookiesB);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('AUDIT_LOG_NOT_FOUND');

      // User from Org B attempts to access Org A endpoint directly
      const crossRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgA}/audit-logs`)
        .set('Cookie', cookiesB);

      expect(crossRes.status).toBe(404);
    });

    it('should allow AUDITOR role read access to audit logs', async () => {
      const { orgId } = await registerUser('admin@corp.com', 'RBAC Corp');
      const { cookies: auditorCookies } = await addMemberToOrg(
        'auditor@corp.com',
        orgId,
        Role.AUDITOR,
      );

      const res = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/audit-logs`)
        .set('Cookie', auditorCookies);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('2. Job Status Tracking APIs & Lifecycle', () => {
    it('should list background jobs with pagination and status filtering', async () => {
      const { cookies, orgId } = await registerUser('jobtest@example.com', 'Jobs Corp');

      await jobsService.createJob(
        orgId,
        JobType.RECONCILIATION_RUN,
        'RECONCILIATION_RUN',
        'run-1',
      );
      const runningJob = await jobsService.createJob(
        orgId,
        JobType.CSV_IMPORT,
        'IMPORT',
        'imp-1',
      );
      await jobsService.markRunning(orgId, runningJob.id);

      // List all jobs
      const res = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/jobs`)
        .set('Cookie', cookies);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.meta.total).toBe(2);

      // Filter by status RUNNING
      const runningRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/jobs?status=${JobStatus.RUNNING}`)
        .set('Cookie', cookies);

      expect(runningRes.status).toBe(200);
      expect(runningRes.body.meta.total).toBe(1);
      expect(runningRes.body.data[0].status).toBe(JobStatus.RUNNING);

      // Filter by jobType CSV_IMPORT
      const importRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/jobs?jobType=${JobType.CSV_IMPORT}`)
        .set('Cookie', cookies);

      expect(importRes.status).toBe(200);
      expect(importRes.body.meta.total).toBe(1);
      expect(importRes.body.data[0].jobType).toBe(JobType.CSV_IMPORT);
    });

    it('should retrieve single job detail and prevent cross-tenant IDOR access', async () => {
      const { cookies: cookiesA, orgId: orgA } = await registerUser('orgAjobs@example.com', 'Org A Jobs');
      const { cookies: cookiesB, orgId: orgB } = await registerUser('orgBjobs@example.com', 'Org B Jobs');

      const jobA = await jobsService.createJob(orgA, JobType.RECONCILIATION_RUN);
      await jobsService.markRunning(orgA, jobA.id, 'Processing matching engine...');
      await jobsService.updateProgress(orgA, jobA.id, 75, 'Computing similarity scores...');

      // Org A reads own job
      const res = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgA}/jobs/${jobA.id}`)
        .set('Cookie', cookiesA);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(jobA.id);
      expect(res.body.status).toBe(JobStatus.RUNNING);
      expect(res.body.progress).toBe(75);
      expect(res.body.message).toBe('Computing similarity scores...');

      // Org B attempts to read Org A job
      const idorRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgB}/jobs/${jobA.id}`)
        .set('Cookie', cookiesB);

      expect(idorRes.status).toBe(404);
      expect(idorRes.body.error.code).toBe('JOB_NOT_FOUND');
    });

    it('should allow AUDITOR role to view jobs', async () => {
      const { orgId } = await registerUser('admin-j@corp.com', 'Jobs RBAC Corp');
      const { cookies: auditorCookies } = await addMemberToOrg(
        'auditor-j@corp.com',
        orgId,
        Role.AUDITOR,
      );

      await jobsService.createJob(orgId, JobType.RECONCILIATION_RUN);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/jobs`)
        .set('Cookie', auditorCookies);

      expect(res.status).toBe(200);
      expect(res.body.meta.total).toBe(1);
    });
  });

  describe('3. Dashboard Aggregates & Read APIs', () => {
    it('should return zeroes for an empty organization', async () => {
      const { cookies, orgId } = await registerUser('empty@example.com', 'Empty Dashboard Corp');

      // 1. Summary
      const summaryRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/dashboard/summary`)
        .set('Cookie', cookies);

      expect(summaryRes.status).toBe(200);
      expect(summaryRes.body.totalTransactions).toBe(0);
      expect(summaryRes.body.totalReconciliationRuns).toBe(0);
      expect(summaryRes.body.completedRuns).toBe(0);
      expect(summaryRes.body.failedRuns).toBe(0);
      expect(summaryRes.body.totalMatchedTransactions).toBe(0);
      expect(summaryRes.body.totalUnmatchedTransactions).toBe(0);
      expect(summaryRes.body.totalOpenExceptions).toBe(0);

      // 2. Reconciliation overview
      const recRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/dashboard/reconciliation`)
        .set('Cookie', cookies);

      expect(recRes.status).toBe(200);
      expect(recRes.body.totalRuns).toBe(0);
      expect(recRes.body.completedRuns).toBe(0);
      expect(recRes.body.matchCounts.exact).toBe(0);
      expect(recRes.body.matchCounts.potential).toBe(0);
      expect(recRes.body.recentRuns).toEqual([]);

      // 3. Exceptions overview
      const excRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/dashboard/exceptions`)
        .set('Cookie', cookies);

      expect(excRes.status).toBe(200);
      expect(excRes.body.byStatus.OPEN).toBe(0);
      expect(excRes.body.byStatus.RESOLVED).toBe(0);
      expect(excRes.body.unassignedCount).toBe(0);
      expect(excRes.body.byAssignee).toEqual([]);

      // 4. Activity feed
      const actRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/dashboard/activity`)
        .set('Cookie', cookies);

      expect(actRes.status).toBe(200);
      expect(actRes.body.data).toEqual([]);
    });

    it('should enforce multi-tenant isolation on dashboard endpoints (prevents IDOR)', async () => {
      const { orgId: orgA } = await registerUser('dashA@example.com', 'Dash Org A');
      const { cookies: cookiesB } = await registerUser('dashB@example.com', 'Dash Org B');

      const res = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgA}/dashboard/summary`)
        .set('Cookie', cookiesB);

      expect(res.status).toBe(404);
    });

    it('should allow AUDITOR and ANALYST roles full read access to dashboard', async () => {
      const { orgId } = await registerUser('dash-admin@corp.com', 'Dash Corp');
      const { cookies: auditorCookies } = await addMemberToOrg(
        'dash-auditor@corp.com',
        orgId,
        Role.AUDITOR,
      );
      const { cookies: analystCookies } = await addMemberToOrg(
        'dash-analyst@corp.com',
        orgId,
        Role.ANALYST,
      );

      const auditorRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/dashboard/summary`)
        .set('Cookie', auditorCookies);
      expect(auditorRes.status).toBe(200);

      const analystRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/dashboard/summary`)
        .set('Cookie', analystCookies);
      expect(analystRes.status).toBe(200);
    });
  });

  describe('4. Complete End-to-End Workflow & Verification (A1 through A8)', () => {
    it('should execute complete workflow: reconciliation -> matches -> exceptions -> jobs -> audit logs -> dashboard verification', async () => {
      // 1. Register Admin & Analyst in Org
      const { cookies: adminCookies, orgId, userId: _adminUserId } = await registerUser(
        'ceo@workflowcorp.com',
        'Workflow Corp',
        Role.ADMIN,
        'CEO Admin',
      );
      const { cookies: analystCookies, userId: analystUserId } = await addMemberToOrg(
        'analyst@workflowcorp.com',
        orgId,
        Role.ANALYST,
        'Lead Analyst',
      );

      // 2. Create Two Data Sources
      const dsA = await createDataSource(adminCookies, orgId, 'Internal Ledger');
      const dsB = await createDataSource(adminCookies, orgId, 'Bank Statement');

      // 3. Seed Transactions:
      // Pair 1: Exact Match (amount: 10000, date: 2026-03-01, ref: 'TX-100')
      // Pair 2: Potential Match (amount: 25000, date: 2026-03-02, ref: 'TX-200' vs 'TX-200-A')
      // Pair 3: Unmatched Transaction in Source A (amount: 99900, date: 2026-03-03, ref: 'TX-300')
      await txnRepo.createBatch(orgId, [
        {
          dataSourceId: dsA.id,
          externalId: 'SRC-A-001',
          amountMinor: 10000,
          currency: 'USD',
          transactionDate: new Date('2026-03-01'),
          reference: 'TX-100',
          status: 'UNMATCHED',
        },
        {
          dataSourceId: dsB.id,
          externalId: 'SRC-B-001',
          amountMinor: 10000,
          currency: 'USD',
          transactionDate: new Date('2026-03-01'),
          reference: 'TX-100',
          status: 'UNMATCHED',
        },
        {
          dataSourceId: dsA.id,
          externalId: 'SRC-A-002',
          amountMinor: 25000,
          currency: 'USD',
          transactionDate: new Date('2026-03-02'),
          reference: 'TX-200',
          status: 'UNMATCHED',
        },
        {
          dataSourceId: dsB.id,
          externalId: 'SRC-B-002',
          amountMinor: 25000,
          currency: 'USD',
          transactionDate: new Date('2026-03-02'),
          reference: 'TX-200-A',
          status: 'UNMATCHED',
        },
        {
          dataSourceId: dsA.id,
          externalId: 'SRC-A-003',
          amountMinor: 99900,
          currency: 'USD',
          transactionDate: new Date('2026-03-03'),
          reference: 'TX-300',
          status: 'UNMATCHED',
        },
      ]);

      // 4. Trigger Reconciliation Run as Analyst
      const runRes = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/reconciliation-runs`)
        .set('Cookie', analystCookies)
        .send({
          sourceA: dsA.id,
          sourceB: dsB.id,
          dateFrom: '2026-03-01',
          dateTo: '2026-03-05',
          config: {
            dateWindowDays: 2,
            exactThreshold: 100,
            potentialThreshold: 60,
          },
        });

      expect(runRes.status).toBe(201);
      const runId = runRes.body.runId;
      expect(runId).toBeDefined();

      // 5. Verify Background Job was tracked for the run
      const jobsRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/jobs?referenceId=${runId}`)
        .set('Cookie', analystCookies);

      expect(jobsRes.status).toBe(200);
      expect(jobsRes.body.meta.total).toBe(1);
      const recJob = jobsRes.body.data[0];
      expect(recJob.status).toBe(JobStatus.COMPLETED);
      expect(recJob.progress).toBe(100);
      expect(recJob.jobType).toBe(JobType.RECONCILIATION_RUN);

      // 6. Inspect Matches
      const matchesRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/reconciliation-runs/${runId}/matches`)
        .set('Cookie', analystCookies);

      expect(matchesRes.status).toBe(200);
      const matches = matchesRes.body.data;
      expect(matches.length).toBeGreaterThanOrEqual(2);

      const potentialMatch = matches.find((m: { classification: string }) => m.classification === 'POTENTIAL');
      expect(potentialMatch).toBeDefined();

      // 7. Confirm or Reject Potential Match as Analyst
      const rejectRes = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/matches/${potentialMatch.id}/reject`)
        .set('Cookie', analystCookies)
        .send({
          reason: 'Counterparty reference mismatch cannot be verified',
        });

      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.status).toBe('REJECTED');

      // 8. Verify Exception Created for Unmatched / Rejected Transaction
      const excsRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/exceptions`)
        .set('Cookie', analystCookies);

      expect(excsRes.status).toBe(200);
      expect(excsRes.body.data.length).toBeGreaterThanOrEqual(1);
      const targetExc = excsRes.body.data[0];

      // 9. Assign Exception to Analyst
      const assignRes = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/exceptions/${targetExc.id}/assign`)
        .set('Cookie', adminCookies)
        .send({
          assigneeId: analystUserId,
        });

      expect(assignRes.status).toBe(200);
      expect(assignRes.body.status).toBe(ExceptionStatus.ASSIGNED);
      expect(assignRes.body.assigneeId).toBe(analystUserId);

      // 10. Add Comment to Exception
      const commentRes = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/exceptions/${targetExc.id}/comments`)
        .set('Cookie', analystCookies)
        .send({
          body: 'Investigation confirmed transaction was refunded by bank merchant',
        });

      expect(commentRes.status).toBe(201);
      expect(commentRes.body.body).toContain('refunded by bank');

      // 11. Move Exception to UNDER_REVIEW
      const reviewRes = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/exceptions/${targetExc.id}/status`)
        .set('Cookie', analystCookies)
        .send({
          action: 'START_REVIEW',
        });

      expect(reviewRes.status).toBe(200);
      expect(reviewRes.body.status).toBe(ExceptionStatus.UNDER_REVIEW);

      // 12. Resolve Exception
      const resolveRes = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgId}/exceptions/${targetExc.id}/status`)
        .set('Cookie', analystCookies)
        .send({
          action: 'RESOLVE',
          resolutionReason: 'Manual journal entry booked in general ledger',
          resolutionAction: ResolutionAction.MANUALLY_RECONCILED,
        });

      expect(resolveRes.status).toBe(200);
      expect(resolveRes.body.status).toBe(ExceptionStatus.RESOLVED);

      // 13. Verify Audit Trail Contains Complete History
      const auditRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/audit-logs`)
        .set('Cookie', adminCookies);

      expect(auditRes.status).toBe(200);
      const auditActions = auditRes.body.data.map((l: { action: string }) => l.action);

      expect(auditActions).toContain(AuditAction.RECONCILIATION_RUN_CREATED);
      expect(auditActions).toContain(AuditAction.RECONCILIATION_RUN_COMPLETED);
      expect(auditActions).toContain(AuditAction.MATCH_REJECTED);
      expect(auditActions).toContain(AuditAction.EXCEPTION_ASSIGNED);
      expect(auditActions).toContain(AuditAction.EXCEPTION_COMMENT_ADDED);
      expect(auditActions).toContain(AuditAction.EXCEPTION_RESOLVED);

      // 13. Verify Dashboard Aggregates Reflect Complete State
      const dashSummary = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/dashboard/summary`)
        .set('Cookie', adminCookies);

      expect(dashSummary.status).toBe(200);
      expect(dashSummary.body.totalTransactions).toBe(5);
      expect(dashSummary.body.totalReconciliationRuns).toBe(1);
      expect(dashSummary.body.completedRuns).toBe(1);
      expect(dashSummary.body.totalResolvedExceptions).toBeGreaterThanOrEqual(1);

      const dashRec = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/dashboard/reconciliation`)
        .set('Cookie', adminCookies);

      expect(dashRec.status).toBe(200);
      expect(dashRec.body.totalRuns).toBe(1);
      expect(dashRec.body.recentRuns.length).toBe(1);

      const dashExc = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/dashboard/exceptions`)
        .set('Cookie', adminCookies);

      expect(dashExc.status).toBe(200);
      expect(dashExc.body.byStatus.RESOLVED).toBeGreaterThanOrEqual(1);

      const dashAct = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgId}/dashboard/activity?limit=10`)
        .set('Cookie', adminCookies);

      expect(dashAct.status).toBe(200);
      expect(dashAct.body.data.length).toBeGreaterThanOrEqual(5);
    });
  });
});
