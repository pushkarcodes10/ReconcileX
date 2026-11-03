import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  DatabaseClient,
  desc,
  eq,
  exceptions,
  ExceptionStatus,
  gte,
  lte,
  matches,
  reconciliationRuns,
  sql,
  transactions,
  users,
} from '@reconcilex/db';
import { SQL } from 'drizzle-orm';
import { DATABASE_CLIENT } from '../../../database/database.constants';
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
export class DrizzleDashboardRepository implements IDashboardRepository {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: DatabaseClient,
  ) {}

  async getSummary(orgId: string): Promise<DashboardSummaryResponseDto> {
    // 1. Transactions aggregates
    const [txnStats] = await this.db
      .select({
        total: sql<string>`count(*)`,
        matched: sql<string>`count(*) filter (where ${transactions.status} = 'MATCHED')`,
        unmatched: sql<string>`count(*) filter (where ${transactions.status} = 'UNMATCHED')`,
        potential: sql<string>`count(*) filter (where ${transactions.status} = 'POTENTIAL_MATCH')`,
      })
      .from(transactions)
      .where(eq(transactions.organizationId, orgId));

    // 2. Reconciliation runs aggregates
    const [runStats] = await this.db
      .select({
        total: sql<string>`count(*)`,
        completed: sql<string>`count(*) filter (where ${reconciliationRuns.status} = 'COMPLETED')`,
        failed: sql<string>`count(*) filter (where ${reconciliationRuns.status} = 'FAILED')`,
        running: sql<string>`count(*) filter (where ${reconciliationRuns.status} = 'PROCESSING' or ${reconciliationRuns.status} = 'PENDING')`,
      })
      .from(reconciliationRuns)
      .where(eq(reconciliationRuns.organizationId, orgId));

    // 3. Exceptions aggregates
    const [excStats] = await this.db
      .select({
        open: sql<string>`count(*) filter (where ${exceptions.status} = ${ExceptionStatus.OPEN})`,
        assigned: sql<string>`count(*) filter (where ${exceptions.status} = ${ExceptionStatus.ASSIGNED})`,
        underReview: sql<string>`count(*) filter (where ${exceptions.status} = ${ExceptionStatus.UNDER_REVIEW})`,
        escalated: sql<string>`count(*) filter (where ${exceptions.status} = ${ExceptionStatus.ESCALATED})`,
        resolved: sql<string>`count(*) filter (where ${exceptions.status} = ${ExceptionStatus.RESOLVED})`,
      })
      .from(exceptions)
      .where(eq(exceptions.organizationId, orgId));

    return {
      totalTransactions: Number(txnStats?.total || 0),
      totalReconciliationRuns: Number(runStats?.total || 0),
      completedRuns: Number(runStats?.completed || 0),
      failedRuns: Number(runStats?.failed || 0),
      runningRuns: Number(runStats?.running || 0),
      totalMatchedTransactions: Number(txnStats?.matched || 0),
      totalUnmatchedTransactions: Number(txnStats?.unmatched || 0),
      totalPotentialMatches: Number(txnStats?.potential || 0),
      totalOpenExceptions: Number(excStats?.open || 0),
      totalAssignedExceptions: Number(excStats?.assigned || 0),
      totalExceptionsUnderReview: Number(excStats?.underReview || 0),
      totalEscalatedExceptions: Number(excStats?.escalated || 0),
      totalResolvedExceptions: Number(excStats?.resolved || 0),
    };
  }

  async getReconciliationOverview(
    orgId: string,
    query?: QueryDashboardReconciliationDto,
  ): Promise<DashboardReconciliationResponseDto> {
    const conditions: SQL[] = [eq(reconciliationRuns.organizationId, orgId)];

    if (query?.startDate) {
      conditions.push(gte(reconciliationRuns.startedAt, new Date(query.startDate)));
    }
    if (query?.endDate) {
      conditions.push(lte(reconciliationRuns.startedAt, new Date(query.endDate)));
    }

    const whereClause = and(...conditions);

    const [runStats] = await this.db
      .select({
        total: sql<string>`count(*)`,
        completed: sql<string>`count(*) filter (where ${reconciliationRuns.status} = 'COMPLETED')`,
        failed: sql<string>`count(*) filter (where ${reconciliationRuns.status} = 'FAILED')`,
        running: sql<string>`count(*) filter (where ${reconciliationRuns.status} = 'PROCESSING' or ${reconciliationRuns.status} = 'PENDING')`,
      })
      .from(reconciliationRuns)
      .where(whereClause);

    // Recent runs
    const recent = await this.db
      .select()
      .from(reconciliationRuns)
      .where(whereClause)
      .orderBy(desc(reconciliationRuns.createdAt))
      .limit(5);

    const recentRuns: RecentRunItemDto[] = recent.map((r) => ({
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

    // Matches aggregate
    const [matchStats] = await this.db
      .select({
        exact: sql<string>`count(*) filter (where ${matches.classification} = 'EXACT')`,
        potential: sql<string>`count(*) filter (where ${matches.classification} = 'POTENTIAL')`,
        confirmed: sql<string>`count(*) filter (where ${matches.status} = 'CONFIRMED')`,
        rejected: sql<string>`count(*) filter (where ${matches.status} = 'REJECTED')`,
      })
      .from(matches)
      .where(eq(matches.organizationId, orgId));

    return {
      totalRuns: Number(runStats?.total || 0),
      completedRuns: Number(runStats?.completed || 0),
      failedRuns: Number(runStats?.failed || 0),
      runningRuns: Number(runStats?.running || 0),
      matchCounts: {
        exact: Number(matchStats?.exact || 0),
        potential: Number(matchStats?.potential || 0),
        confirmed: Number(matchStats?.confirmed || 0),
        rejected: Number(matchStats?.rejected || 0),
      },
      recentRuns,
    };
  }

  async getExceptionsOverview(orgId: string): Promise<DashboardExceptionsResponseDto> {
    const [excStats] = await this.db
      .select({
        open: sql<string>`count(*) filter (where ${exceptions.status} = ${ExceptionStatus.OPEN})`,
        assigned: sql<string>`count(*) filter (where ${exceptions.status} = ${ExceptionStatus.ASSIGNED})`,
        underReview: sql<string>`count(*) filter (where ${exceptions.status} = ${ExceptionStatus.UNDER_REVIEW})`,
        escalated: sql<string>`count(*) filter (where ${exceptions.status} = ${ExceptionStatus.ESCALATED})`,
        resolved: sql<string>`count(*) filter (where ${exceptions.status} = ${ExceptionStatus.RESOLVED})`,
        unassigned: sql<string>`count(*) filter (where ${exceptions.assigneeId} is null and ${exceptions.status} != ${ExceptionStatus.RESOLVED})`,
      })
      .from(exceptions)
      .where(eq(exceptions.organizationId, orgId));

    // Group by assignee
    const assigneeRows = await this.db
      .select({
        assigneeId: exceptions.assigneeId,
        assigneeName: users.name,
        count: sql<string>`count(*)`,
      })
      .from(exceptions)
      .leftJoin(users, eq(exceptions.assigneeId, users.id))
      .where(
        and(
          eq(exceptions.organizationId, orgId),
          sql`${exceptions.assigneeId} is not null`,
          sql`${exceptions.status} != ${ExceptionStatus.RESOLVED}`,
        ),
      )
      .groupBy(exceptions.assigneeId, users.name);

    const byAssignee: AssigneeExceptionCountDto[] = assigneeRows.map((row) => ({
      assigneeId: row.assigneeId,
      assigneeName: row.assigneeName || 'Unknown',
      count: Number(row.count || 0),
    }));

    // Recent created
    const recentCreated = await this.db
      .select()
      .from(exceptions)
      .where(eq(exceptions.organizationId, orgId))
      .orderBy(desc(exceptions.createdAt))
      .limit(5);

    // Recent resolved
    const recentResolved = await this.db
      .select()
      .from(exceptions)
      .where(
        and(
          eq(exceptions.organizationId, orgId),
          eq(exceptions.status, ExceptionStatus.RESOLVED),
        ),
      )
      .orderBy(desc(exceptions.resolvedAt))
      .limit(5);

    return {
      byStatus: {
        OPEN: Number(excStats?.open || 0),
        ASSIGNED: Number(excStats?.assigned || 0),
        UNDER_REVIEW: Number(excStats?.underReview || 0),
        ESCALATED: Number(excStats?.escalated || 0),
        RESOLVED: Number(excStats?.resolved || 0),
      },
      unassignedCount: Number(excStats?.unassigned || 0),
      byAssignee,
      recentCreated: recentCreated.map((e) => ({
        id: e.id,
        runId: e.runId,
        transactionId: e.transactionId,
        status: e.status,
        createdAt: e.createdAt.toISOString(),
      })),
      recentResolved: recentResolved.map((e) => ({
        id: e.id,
        runId: e.runId,
        transactionId: e.transactionId,
        status: e.status,
        resolutionReason: e.resolutionReason,
        resolutionAction: e.resolutionAction,
        resolvedAt: e.resolvedAt ? e.resolvedAt.toISOString() : null,
      })),
    };
  }
}
