import { NotFoundException } from '@nestjs/common';
import {
  ActorType,
  AuditAction,
  AuditEntityType,
  ExceptionStatus,
  JobStatus,
  JobType,
} from '@reconcilex/db';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuditService } from '../src/modules/audit/audit.service';
import { InMemoryAuditRepository } from '../src/modules/audit/repositories/in-memory-audit.repository';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';
import { InMemoryDashboardRepository } from '../src/modules/dashboard/repositories/in-memory-dashboard.repository';
import { InMemoryExceptionsRepository } from '../src/modules/exceptions/repositories/in-memory-exceptions.repository';
import { JobsService } from '../src/modules/jobs/jobs.service';
import { InMemoryJobsRepository } from '../src/modules/jobs/repositories/in-memory-jobs.repository';
import { InMemoryReconciliationRepository } from '../src/modules/reconciliation/repositories/in-memory-reconciliation.repository';
import { InMemoryTransactionsRepository } from '../src/modules/transactions/repositories/in-memory-transactions.repository';

describe('Phase A8 Unit Tests', () => {
  const orgA = '11111111-1111-4111-8111-111111111111';
  const orgB = '22222222-2222-4222-8222-222222222222';
  const userA = '33333333-3333-4333-8333-333333333333';

  describe('AuditService', () => {
    let auditRepo: InMemoryAuditRepository;
    let auditService: AuditService;

    beforeEach(() => {
      auditRepo = new InMemoryAuditRepository();
      auditService = new AuditService(auditRepo);
    });

    it('should write valid user audit log entry', async () => {
      const entry = await auditService.logUserAction(
        orgA,
        userA,
        AuditAction.RECONCILIATION_RUN_CREATED,
        AuditEntityType.RECONCILIATION_RUN,
        'run-123',
        { displayId: 'RUN-20260311-001' },
      );

      expect(entry.id).toBeDefined();
      expect(entry.organizationId).toBe(orgA);
      expect(entry.actorId).toBe(userA);
      expect(entry.actorType).toBe(ActorType.USER);
      expect(entry.action).toBe(AuditAction.RECONCILIATION_RUN_CREATED);
      expect(entry.entityType).toBe(AuditEntityType.RECONCILIATION_RUN);
      expect(entry.entityId).toBe('run-123');
      expect(entry.metadata).toEqual({ displayId: 'RUN-20260311-001' });
    });

    it('should write valid system audit log entry', async () => {
      const entry = await auditService.logSystemAction(
        orgA,
        AuditAction.RECONCILIATION_RUN_COMPLETED,
        AuditEntityType.RECONCILIATION_RUN,
        'run-123',
        { exactMatches: 10, potentialMatches: 2 },
      );

      expect(entry.actorId).toBeNull();
      expect(entry.actorType).toBe(ActorType.SYSTEM);
      expect(entry.action).toBe(AuditAction.RECONCILIATION_RUN_COMPLETED);
    });

    it('should sanitize sensitive keys in metadata (passwords, tokens, secrets, cookies)', async () => {
      const entry = await auditService.logUserAction(
        orgA,
        userA,
        AuditAction.USER_LOGGED_IN,
        AuditEntityType.USER,
        userA,
        {
          password: 'super-secret-password',
          refreshToken: 'jwt-refresh-token',
          apiSecret: 'my-secret-key',
          authorization: 'Bearer 12345',
          cookie: 'session=xyz',
          normalData: 'should-stay-intact',
          nested: {
            subPassword: 'nested-secret',
            safeField: 'hello',
          },
        },
      );

      const metadata = entry.metadata as Record<string, unknown> & {
        nested: { subPassword: string; safeField: string };
      };
      expect(metadata.password).toBe('[REDACTED]');
      expect(metadata.refreshToken).toBe('[REDACTED]');
      expect(metadata.apiSecret).toBe('[REDACTED]');
      expect(metadata.authorization).toBe('[REDACTED]');
      expect(metadata.cookie).toBe('[REDACTED]');
      expect(metadata.normalData).toBe('should-stay-intact');
      expect(metadata.nested.subPassword).toBe('[REDACTED]');
      expect(metadata.nested.safeField).toBe('hello');
    });

    it('should query and filter audit logs by action, actor, entity, date range, and pagination', async () => {
      // Seed logs
      await auditService.logUserAction(
        orgA,
        userA,
        AuditAction.MATCH_CONFIRMED,
        AuditEntityType.MATCH,
        'match-1',
      );
      await auditService.logUserAction(
        orgA,
        userA,
        AuditAction.MATCH_REJECTED,
        AuditEntityType.MATCH,
        'match-2',
      );
      await auditService.logSystemAction(
        orgA,
        AuditAction.EXCEPTION_CREATED,
        AuditEntityType.EXCEPTION,
        'exc-1',
      );
      await auditService.logUserAction(
        orgB,
        userA,
        AuditAction.MATCH_CONFIRMED,
        AuditEntityType.MATCH,
        'match-3',
      );

      // Org A total logs
      const orgALogs = await auditService.getAuditLogs(orgA, {});
      expect(orgALogs.meta.total).toBe(3);
      expect(orgALogs.data.length).toBe(3);

      // Filter by action
      const confirmedLogs = await auditService.getAuditLogs(orgA, {
        action: AuditAction.MATCH_CONFIRMED,
      });
      expect(confirmedLogs.meta.total).toBe(1);
      expect(confirmedLogs.data[0].entityId).toBe('match-1');

      // Filter by entityType
      const matchLogs = await auditService.getAuditLogs(orgA, {
        entityType: AuditEntityType.MATCH,
      });
      expect(matchLogs.meta.total).toBe(2);

      // Filter by actorId
      const userLogs = await auditService.getAuditLogs(orgA, { actorId: userA });
      expect(userLogs.meta.total).toBe(2);

      // Pagination
      const page1 = await auditService.getAuditLogs(orgA, { page: 1, limit: 2 });
      expect(page1.data.length).toBe(2);
      expect(page1.meta.totalPages).toBe(2);

      const page2 = await auditService.getAuditLogs(orgA, { page: 2, limit: 2 });
      expect(page2.data.length).toBe(1);
    });

    it('should throw NotFoundException when audit log does not exist or belongs to another org', async () => {
      const entry = await auditService.logUserAction(
        orgA,
        userA,
        AuditAction.MATCH_CONFIRMED,
        AuditEntityType.MATCH,
        'match-1',
      );

      const found = await auditService.getAuditLogById(orgA, entry.id);
      expect(found.id).toBe(entry.id);

      // Other org cannot access
      await expect(auditService.getAuditLogById(orgB, entry.id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('JobsService', () => {
    let jobsRepo: InMemoryJobsRepository;
    let jobsService: JobsService;

    beforeEach(() => {
      jobsRepo = new InMemoryJobsRepository();
      jobsService = new JobsService(jobsRepo);
    });

    it('should create a job in QUEUED status', async () => {
      const job = await jobsService.createJob(
        orgA,
        JobType.RECONCILIATION_RUN,
        'RECONCILIATION_RUN',
        'run-123',
      );

      expect(job.id).toBeDefined();
      expect(job.status).toBe(JobStatus.QUEUED);
      expect(job.progress).toBe(0);
      expect(job.referenceType).toBe('RECONCILIATION_RUN');
      expect(job.referenceId).toBe('run-123');
    });

    it('should progress through complete lifecycle QUEUED -> RUNNING -> COMPLETED', async () => {
      const job = await jobsService.createJob(orgA, JobType.CSV_IMPORT, 'IMPORT', 'imp-1');
      expect(job.status).toBe(JobStatus.QUEUED);

      // Start running
      const runningJob = await jobsService.markRunning(orgA, job.id, 'Reading CSV stream...');
      expect(runningJob.status).toBe(JobStatus.RUNNING);
      expect(runningJob.message).toBe('Reading CSV stream...');
      expect(runningJob.startedAt).toBeDefined();

      // Update progress
      const progressJob = await jobsService.updateProgress(orgA, job.id, 50, 'Processed 500 rows');
      expect(progressJob.progress).toBe(50);
      expect(progressJob.message).toBe('Processed 500 rows');

      // Complete
      const completedJob = await jobsService.markCompleted(orgA, job.id, {
        totalRows: 1000,
        validCount: 1000,
      });
      expect(completedJob.status).toBe(JobStatus.COMPLETED);
      expect(completedJob.progress).toBe(100);
      expect(completedJob.completedAt).toBeDefined();
      expect(completedJob.result).toEqual({ totalRows: 1000, validCount: 1000 });
    });

    it('should handle failure transition RUNNING -> FAILED with sanitized error', async () => {
      const job = await jobsService.createJob(orgA, JobType.CSV_IMPORT);
      await jobsService.markRunning(orgA, job.id);

      const failedJob = await jobsService.markFailed(
        orgA,
        job.id,
        new Error('CSV headers do not match data source column mapping'),
      );

      expect(failedJob.status).toBe(JobStatus.FAILED);
      expect(failedJob.completedAt).toBeDefined();
      expect(failedJob.error).toEqual({
        message: 'CSV headers do not match data source column mapping',
      });
    });

    it('should reject invalid transitions (COMPLETED -> RUNNING, FAILED -> RUNNING)', async () => {
      const job = await jobsService.createJob(orgA, JobType.RECONCILIATION_RUN);
      await jobsService.markRunning(orgA, job.id);
      await jobsService.markCompleted(orgA, job.id);

      // Attempt invalid transition
      await expect(jobsService.markRunning(orgA, job.id)).rejects.toThrow();
      await expect(jobsService.markFailed(orgA, job.id, 'fail')).rejects.toThrow();
    });

    it('should filter jobs and protect against IDOR', async () => {
      await jobsService.createJob(orgA, JobType.RECONCILIATION_RUN);
      const orgBJob = await jobsService.createJob(orgB, JobType.CSV_IMPORT);

      const orgAJobs = await jobsService.listJobs(orgA, {});
      expect(orgAJobs.meta.total).toBe(1);

      // Org A cannot access Org B's job
      await expect(jobsService.getJob(orgA, orgBJob.id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('DashboardService', () => {
    let auditRepo: InMemoryAuditRepository;
    let auditService: AuditService;
    let txnRepo: InMemoryTransactionsRepository;
    let reconciliationRepo: InMemoryReconciliationRepository;
    let exceptionsRepo: InMemoryExceptionsRepository;
    let dashboardRepo: InMemoryDashboardRepository;
    let dashboardService: DashboardService;

    beforeEach(() => {
      auditRepo = new InMemoryAuditRepository();
      auditService = new AuditService(auditRepo);
      txnRepo = new InMemoryTransactionsRepository();
      reconciliationRepo = new InMemoryReconciliationRepository();
      exceptionsRepo = new InMemoryExceptionsRepository();
      dashboardRepo = new InMemoryDashboardRepository(
        txnRepo,
        reconciliationRepo,
        exceptionsRepo,
      );
      dashboardService = new DashboardService(dashboardRepo, auditService);
    });

    it('should return zeroes for an empty organization', async () => {
      const summary = await dashboardService.getSummary(orgA);
      expect(summary.totalTransactions).toBe(0);
      expect(summary.totalReconciliationRuns).toBe(0);
      expect(summary.completedRuns).toBe(0);
      expect(summary.failedRuns).toBe(0);
      expect(summary.totalMatchedTransactions).toBe(0);
      expect(summary.totalUnmatchedTransactions).toBe(0);
      expect(summary.totalOpenExceptions).toBe(0);

      const rec = await dashboardService.getReconciliation(orgA, {});
      expect(rec.totalRuns).toBe(0);
      expect(rec.matchCounts.exact).toBe(0);
      expect(rec.matchCounts.potential).toBe(0);
      expect(rec.recentRuns).toEqual([]);

      const exc = await dashboardService.getExceptions(orgA);
      expect(exc.byStatus[ExceptionStatus.OPEN]).toBe(0);
      expect(exc.byAssignee).toEqual([]);

      const act = await dashboardService.getActivity(orgA, {});
      expect(act.data).toEqual([]);
    });

    it('should calculate accurate summary and reconciliation metrics when data exists', async () => {
      // Seed transactions
      await txnRepo.createBatch(orgA, [
        {
          dataSourceId: 'ds-1',
          externalId: 'tx-1',
          amountMinor: 10000,
          currency: 'USD',
          transactionDate: new Date('2026-03-01'),
          status: 'MATCHED',
        },
        {
          dataSourceId: 'ds-1',
          externalId: 'tx-2',
          amountMinor: 20000,
          currency: 'USD',
          transactionDate: new Date('2026-03-02'),
          status: 'UNMATCHED',
        },
      ]);

      // Seed run
      const run = await reconciliationRepo.createRun({
        organizationId: orgA,
        displayId: 'RUN-20260301-001',
        sourceAId: 'ds-1',
        sourceBId: 'ds-2',
        status: 'COMPLETED',
        startedAt: new Date('2026-03-01T10:00:00Z'),
        completedAt: new Date('2026-03-01T10:01:00Z'),
        config: {},
        totalSourceA: 1,
        totalSourceB: 1,
        exactMatchCount: 1,
        potentialMatchCount: 0,
        unmatchedCount: 1,
        createdBy: userA,
      });

      // Seed match
      reconciliationRepo.matches.push({
        id: 'm-1',
        organizationId: orgA,
        runId: run.id,
        transactionAId: 'tx-1',
        transactionBId: 'tx-2',
        classification: 'EXACT',
        score: 100,
        reasons: null,
        status: 'CONFIRMED',
        confirmedBy: userA,
        confirmedAt: new Date(),
        rejectedBy: null,
        rejectedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Seed exception
      await exceptionsRepo.createMany([
        {
          organizationId: orgA,
          runId: 'run-1',
          transactionId: 'tx-2',
          status: ExceptionStatus.OPEN,
        },
      ]);

      const summary = await dashboardService.getSummary(orgA);
      expect(summary.totalTransactions).toBe(2);
      expect(summary.totalMatchedTransactions).toBe(1);
      expect(summary.totalUnmatchedTransactions).toBe(1);
      expect(summary.totalReconciliationRuns).toBe(1);
      expect(summary.completedRuns).toBe(1);
      expect(summary.totalOpenExceptions).toBe(1);

      const rec = await dashboardService.getReconciliation(orgA, {});
      expect(rec.totalRuns).toBe(1);
      expect(rec.matchCounts.exact).toBe(1);
      expect(rec.matchCounts.potential).toBe(0);
      expect(rec.recentRuns.length).toBe(1);
      expect(rec.recentRuns[0].displayId).toBe('RUN-20260301-001');

      const exc = await dashboardService.getExceptions(orgA);
      expect(exc.byStatus[ExceptionStatus.OPEN]).toBe(1);
      expect(exc.byStatus[ExceptionStatus.RESOLVED]).toBe(0);
    });

    it('should return recent activity items via AuditService in dashboard', async () => {
      await auditService.logUserAction(
        orgA,
        userA,
        AuditAction.RECONCILIATION_RUN_CREATED,
        AuditEntityType.RECONCILIATION_RUN,
        'run-1',
        { displayId: 'RUN-20260301-001' },
      );
      await auditService.logUserAction(
        orgA,
        userA,
        AuditAction.MATCH_CONFIRMED,
        AuditEntityType.MATCH,
        'match-1',
      );

      const activity = await dashboardService.getActivity(orgA, { limit: 10 });
      expect(activity.data.length).toBe(2);
      expect(activity.data[0].action).toBe(AuditAction.MATCH_CONFIRMED);
      expect(activity.data[1].action).toBe(AuditAction.RECONCILIATION_RUN_CREATED);
    });
  });
});
