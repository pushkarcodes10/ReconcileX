import { Injectable } from '@nestjs/common';
import { ExceptionStatus } from '@reconcilex/db';
import { InMemoryAuthRepository } from '../../auth/repositories/in-memory-auth.repository';
import { InMemoryExceptionsRepository } from '../../exceptions/repositories/in-memory-exceptions.repository';
import { InMemoryReconciliationRepository } from '../../reconciliation/repositories/in-memory-reconciliation.repository';
import { InMemoryTransactionsRepository } from '../../transactions/repositories/in-memory-transactions.repository';
import {
  AssigneeExceptionCountDto,
  DashboardExceptionsResponseDto,
  DashboardReconciliationResponseDto,
  DashboardSummaryResponseDto,
  QueryDashboardReconciliationDto,
  RecentRunItemDto,
} from '../dto';
import { IDashboardRepository } from './dashboard.repository.interface';

@Injectable()
export class InMemoryDashboardRepository implements IDashboardRepository {
  constructor(
    private readonly transactionsRepo?: InMemoryTransactionsRepository,
    private readonly reconciliationRepo?: InMemoryReconciliationRepository,
    private readonly exceptionsRepo?: InMemoryExceptionsRepository,
    private readonly authRepo?: InMemoryAuthRepository,
  ) {}

  async getSummary(orgId: string): Promise<DashboardSummaryResponseDto> {
    const txns = this.transactionsRepo?.transactions.filter((t) => t.organizationId === orgId) || [];
    const runs = this.reconciliationRepo?.runs.filter((r) => r.organizationId === orgId) || [];
    const excs = this.exceptionsRepo?.exceptions.filter((e) => e.organizationId === orgId) || [];

    const matchedTxns = txns.filter((t) => t.status === 'MATCHED').length;
    const unmatchedTxns = txns.filter((t) => t.status === 'UNMATCHED').length;
    const potentialTxns = txns.filter((t) => t.status === 'POTENTIAL_MATCH').length;

    const completedRuns = runs.filter((r) => r.status === 'COMPLETED').length;
    const failedRuns = runs.filter((r) => r.status === 'FAILED').length;
    const runningRuns = runs.filter(
      (r) => r.status === 'PROCESSING' || r.status === 'PENDING',
    ).length;

    const openExcs = excs.filter((e) => e.status === ExceptionStatus.OPEN).length;
    const assignedExcs = excs.filter((e) => e.status === ExceptionStatus.ASSIGNED).length;
    const underReviewExcs = excs.filter((e) => e.status === ExceptionStatus.UNDER_REVIEW).length;
    const escalatedExcs = excs.filter((e) => e.status === ExceptionStatus.ESCALATED).length;
    const resolvedExcs = excs.filter((e) => e.status === ExceptionStatus.RESOLVED).length;

    return {
      totalTransactions: txns.length,
      totalReconciliationRuns: runs.length,
      completedRuns,
      failedRuns,
      runningRuns,
      totalMatchedTransactions: matchedTxns,
      totalUnmatchedTransactions: unmatchedTxns,
      totalPotentialMatches: potentialTxns,
      totalOpenExceptions: openExcs,
      totalAssignedExceptions: assignedExcs,
      totalExceptionsUnderReview: underReviewExcs,
      totalEscalatedExceptions: escalatedExcs,
      totalResolvedExceptions: resolvedExcs,
    };
  }

  async getReconciliationOverview(
    orgId: string,
    query?: QueryDashboardReconciliationDto,
  ): Promise<DashboardReconciliationResponseDto> {
    let runs = this.reconciliationRepo?.runs.filter((r) => r.organizationId === orgId) || [];
    const matches = this.reconciliationRepo?.matches.filter((m) => m.organizationId === orgId) || [];

    if (query?.startDate) {
      const from = new Date(query.startDate).getTime();
      runs = runs.filter((r) => new Date(r.startedAt).getTime() >= from);
    }
    if (query?.endDate) {
      const to = new Date(query.endDate).getTime();
      runs = runs.filter((r) => new Date(r.startedAt).getTime() <= to);
    }

    const completedRuns = runs.filter((r) => r.status === 'COMPLETED').length;
    const failedRuns = runs.filter((r) => r.status === 'FAILED').length;
    const runningRuns = runs.filter(
      (r) => r.status === 'PROCESSING' || r.status === 'PENDING',
    ).length;

    // Recent runs
    const sorted = [...runs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const recentRuns: RecentRunItemDto[] = sorted.slice(0, 5).map((r) => ({
      id: r.id,
      displayId: r.displayId,
      status: r.status,
      sourceAId: r.sourceAId,
      sourceBId: r.sourceBId,
      totalSourceA: r.totalSourceA,
      totalSourceB: r.totalSourceB,
      exactMatchCount: r.exactMatchCount,
      potentialMatchCount: r.potentialMatchCount,
      unmatchedCount: r.unmatchedCount,
      startedAt: r.startedAt.toISOString(),
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    }));

    const exactMatches = matches.filter((m) => m.classification === 'EXACT').length;
    const potentialMatches = matches.filter((m) => m.classification === 'POTENTIAL').length;
    const confirmedMatches = matches.filter((m) => m.status === 'CONFIRMED').length;
    const rejectedMatches = matches.filter((m) => m.status === 'REJECTED').length;

    return {
      totalRuns: runs.length,
      completedRuns,
      failedRuns,
      runningRuns,
      matchCounts: {
        exact: exactMatches,
        potential: potentialMatches,
        confirmed: confirmedMatches,
        rejected: rejectedMatches,
      },
      recentRuns,
    };
  }

  async getExceptionsOverview(orgId: string): Promise<DashboardExceptionsResponseDto> {
    const excs = this.exceptionsRepo?.exceptions.filter((e) => e.organizationId === orgId) || [];

    const open = excs.filter((e) => e.status === ExceptionStatus.OPEN).length;
    const assigned = excs.filter((e) => e.status === ExceptionStatus.ASSIGNED).length;
    const underReview = excs.filter((e) => e.status === ExceptionStatus.UNDER_REVIEW).length;
    const escalated = excs.filter((e) => e.status === ExceptionStatus.ESCALATED).length;
    const resolved = excs.filter((e) => e.status === ExceptionStatus.RESOLVED).length;
    const unassigned = excs.filter(
      (e) => !e.assigneeId && e.status !== ExceptionStatus.RESOLVED,
    ).length;

    // Group by assignee
    const assigneeMap = new Map<string, number>();
    for (const e of excs) {
      if (e.assigneeId && e.status !== ExceptionStatus.RESOLVED) {
        assigneeMap.set(e.assigneeId, (assigneeMap.get(e.assigneeId) || 0) + 1);
      }
    }

    const byAssignee: AssigneeExceptionCountDto[] = [];
    for (const [assigneeId, count] of assigneeMap.entries()) {
      const user = this.authRepo?.users.get(assigneeId);
      byAssignee.push({
        assigneeId,
        assigneeName: user ? user.name : `User ${assigneeId.slice(0, 6)}`,
        count,
      });
    }

    // Recent created
    const recentCreated = [...excs]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .map((e) => ({
        id: e.id,
        runId: e.runId,
        transactionId: e.transactionId,
        status: e.status,
        createdAt: e.createdAt.toISOString(),
      }));

    // Recent resolved
    const recentResolved = excs
      .filter((e) => e.status === ExceptionStatus.RESOLVED)
      .sort(
        (a, b) =>
          new Date(b.resolvedAt || 0).getTime() - new Date(a.resolvedAt || 0).getTime(),
      )
      .slice(0, 5)
      .map((e) => ({
        id: e.id,
        runId: e.runId,
        transactionId: e.transactionId,
        status: e.status,
        resolutionReason: e.resolutionReason,
        resolutionAction: e.resolutionAction,
        resolvedAt: e.resolvedAt ? e.resolvedAt.toISOString() : null,
      }));

    return {
      byStatus: {
        OPEN: open,
        ASSIGNED: assigned,
        UNDER_REVIEW: underReview,
        ESCALATED: escalated,
        RESOLVED: resolved,
      },
      unassignedCount: unassigned,
      byAssignee,
      recentCreated,
      recentResolved,
    };
  }
}
