import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  MatchClassification,
  MatchStatus,
  ReconciliationRunStatus,
} from '@reconcilex/db';
import { ExceptionsService } from '../exceptions/exceptions.service';
import {
  DATA_SOURCES_REPOSITORY,
  IDataSourcesRepository,
} from '../data-sources/repositories/data-sources.repository.interface';
import { CreateReconciliationRunDto } from './dto/create-reconciliation-run.dto';
import { QueryMatchesDto } from './dto/query-matches.dto';
import { QueryReconciliationRunsDto } from './dto/query-reconciliation-runs.dto';
import { QueryUnmatchedDto } from './dto/query-unmatched.dto';
import {
  CreateReconciliationRunResponseDto,
  MatchDetailDto,
  PaginatedResponse,
  ReconciliationRunDetailDto,
  ReconciliationRunItemDto,
  UnmatchedTransactionItemDto,
} from './dto/reconciliation-response.dto';
import { RejectMatchDto } from './dto/reject-match.dto';
import {
  IReconciliationJobService,
  RECONCILIATION_JOB_SERVICE,
} from './job/reconciliation-job.interface';
import {
  IReconciliationRepository,
  RECONCILIATION_REPOSITORY,
} from './repositories/reconciliation.repository.interface';

@Injectable()
export class ReconciliationService {
  constructor(
    @Inject(RECONCILIATION_REPOSITORY)
    private readonly reconciliationRepo: IReconciliationRepository,
    @Inject(DATA_SOURCES_REPOSITORY)
    private readonly dataSourcesRepo: IDataSourcesRepository,
    @Inject(RECONCILIATION_JOB_SERVICE)
    private readonly jobService: IReconciliationJobService,
    @Optional()
    private readonly exceptionsService?: ExceptionsService,
  ) {}

  async createRun(
    orgId: string,
    userId: string,
    dto: CreateReconciliationRunDto,
    idempotencyKey?: string,
  ): Promise<CreateReconciliationRunResponseDto> {
    // 1. Validate distinct data sources
    if (dto.sourceA === dto.sourceB) {
      throw new BadRequestException({
        code: 'SAME_SOURCE',
        message: 'Source A and Source B must be different.',
      });
    }

    // 2. Validate date range
    const fromDate = new Date(dto.dateFrom);
    const toDate = new Date(dto.dateTo);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime()) || fromDate > toDate) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: 'dateFrom cannot be after dateTo.',
      });
    }

    // 3. Verify data sources exist in this organization (prevents IDOR)
    const sourceA = await this.dataSourcesRepo.findById(orgId, dto.sourceA);
    const sourceB = await this.dataSourcesRepo.findById(orgId, dto.sourceB);

    if (!sourceA || !sourceB) {
      throw new NotFoundException({
        code: 'SOURCE_NOT_FOUND',
        message: 'One or both data sources were not found in this organization.',
      });
    }

    // 4. Verify data sources are active
    if (sourceA.status !== 'ACTIVE' || sourceB.status !== 'ACTIVE') {
      throw new BadRequestException({
        code: 'INVALID_SOURCE',
        message: 'Both data sources must be active.',
      });
    }

    // 5. Idempotency Key validation
    if (idempotencyKey) {
      const existing = await this.reconciliationRepo.findRunByIdempotencyKey(orgId, idempotencyKey);
      if (existing) {
        const existingConfig = (existing.config || {}) as Record<string, unknown>;
        const matchesParams =
          existing.sourceAId === dto.sourceA &&
          existing.sourceBId === dto.sourceB &&
          existingConfig.dateFrom === dto.dateFrom &&
          existingConfig.dateTo === dto.dateTo;

        if (matchesParams) {
          return {
            jobId: existing.id,
            runId: existing.id,
            status: existing.status as ReconciliationRunStatus,
            run: existing,
          };
        } else {
          throw new ConflictException({
            code: 'IDEMPOTENCY_CONFLICT',
            message: 'Idempotency key has already been used with different request parameters.',
          });
        }
      }
    }

    // 6. Prevent duplicate active runs for this source pair
    const activeRun = await this.reconciliationRepo.findActiveRunForSources(
      orgId,
      dto.sourceA,
      dto.sourceB,
    );
    if (activeRun) {
      throw new ConflictException({
        code: 'RUN_ALREADY_PROCESSING',
        message: 'A reconciliation run is already active for this data source pair.',
      });
    }

    // 7. Generate Display ID
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
    const displayId = await this.reconciliationRepo.getNextDisplayId(orgId, dateStr);

    // 8. Snapshot matching configuration
    const dateWindowDays = dto.config?.dateWindowDays ?? 2;
    const potentialThreshold = dto.config?.potentialThreshold ?? 60;
    const exactThreshold = dto.config?.exactThreshold ?? 100;
    const potentialStrongThreshold = Math.max(
      potentialThreshold,
      Math.min(80, exactThreshold),
    );

    const snapshotConfig = {
      dateFrom: dto.dateFrom,
      dateTo: dto.dateTo,
      dateWindowDays,
      potentialThreshold,
      exactThreshold,
      matchingConfig: {
        dateToleranceDays: dateWindowDays,
        thresholds: {
          exact: exactThreshold,
          potentialStrong: potentialStrongThreshold,
          potential: potentialThreshold,
        },
        weights: {
          amount: 30,
          date: 20,
          reference: 50,
          externalIdentifier: 20,
          referenceSimilar: 30,
        },
      },
    };

    // 9. Create Run record in DB
    const newRun = await this.reconciliationRepo.createRun({
      organizationId: orgId,
      displayId,
      sourceAId: dto.sourceA,
      sourceBId: dto.sourceB,
      status: 'PENDING',
      startedAt: now,
      config: snapshotConfig,
      totalSourceA: 0,
      totalSourceB: 0,
      exactMatchCount: 0,
      potentialMatchCount: 0,
      unmatchedCount: 0,
      idempotencyKey: idempotencyKey || null,
      createdBy: userId,
    });

    // 10. Execute matching engine via JobService
    await this.jobService.submitRun(newRun, {
      matchingConfig: snapshotConfig.matchingConfig,
      dateFrom: dto.dateFrom,
      dateTo: dto.dateTo,
    });

    // 11. Retrieve completed run
    const completedRun = await this.reconciliationRepo.findRunById(orgId, newRun.id);

    return {
      jobId: completedRun!.id,
      runId: completedRun!.id,
      status: completedRun!.status as ReconciliationRunStatus,
      run: completedRun!,
    };
  }

  async getRuns(
    orgId: string,
    query: QueryReconciliationRunsDto,
  ): Promise<PaginatedResponse<ReconciliationRunItemDto>> {
    const { data, total } = await this.reconciliationRepo.findRuns(orgId, query);
    const limit = query.limit || 20;
    const page = query.page || 1;
    const totalPages = Math.ceil(total / limit) || (total === 0 ? 0 : 1);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
    };
  }

  async getRunDetail(orgId: string, runId: string): Promise<ReconciliationRunDetailDto> {
    const run = await this.reconciliationRepo.findRunDetailById(orgId, runId);
    if (!run) {
      throw new NotFoundException({
        code: 'RUN_NOT_FOUND',
        message: 'Reconciliation run not found',
      });
    }

    return {
      ...run,
      sourceA: {
        id: run.sourceA.id,
        name: run.sourceA.name,
        type: run.sourceA.type,
        status: run.sourceA.status,
      },
      sourceB: {
        id: run.sourceB.id,
        name: run.sourceB.name,
        type: run.sourceB.type,
        status: run.sourceB.status,
      },
    };
  }

  async getMatches(
    orgId: string,
    runId: string,
    query: QueryMatchesDto,
  ): Promise<PaginatedResponse<MatchDetailDto>> {
    const run = await this.reconciliationRepo.findRunById(orgId, runId);
    if (!run) {
      throw new NotFoundException({
        code: 'RUN_NOT_FOUND',
        message: 'Reconciliation run not found',
      });
    }

    const { data, total } = await this.reconciliationRepo.findMatches(orgId, runId, query);
    const limit = query.limit || 20;
    const page = query.page || 1;
    const totalPages = Math.ceil(total / limit) || (total === 0 ? 0 : 1);

    const mapped: MatchDetailDto[] = data.map((m) => ({
      ...m,
      classification: m.classification as MatchClassification,
      status: m.status as MatchStatus,
      transactionA: {
        id: m.transactionA.id,
        dataSourceId: m.transactionA.dataSourceId,
        externalId: m.transactionA.externalId,
        amountMinor: m.transactionA.amountMinor,
        currency: m.transactionA.currency,
        transactionDate: m.transactionA.transactionDate,
        reference: m.transactionA.reference,
        externalTxnId: m.transactionA.externalTxnId,
        merchantOrOrderId: m.transactionA.merchantOrOrderId,
        txnType: m.transactionA.txnType,
        status: m.transactionA.status,
      },
      transactionB: {
        id: m.transactionB.id,
        dataSourceId: m.transactionB.dataSourceId,
        externalId: m.transactionB.externalId,
        amountMinor: m.transactionB.amountMinor,
        currency: m.transactionB.currency,
        transactionDate: m.transactionB.transactionDate,
        reference: m.transactionB.reference,
        externalTxnId: m.transactionB.externalTxnId,
        merchantOrOrderId: m.transactionB.merchantOrOrderId,
        txnType: m.transactionB.txnType,
        status: m.transactionB.status,
      },
    }));

    return {
      data: mapped,
      total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
    };
  }

  async getUnmatched(
    orgId: string,
    runId: string,
    query: QueryUnmatchedDto,
  ): Promise<PaginatedResponse<UnmatchedTransactionItemDto>> {
    const run = await this.reconciliationRepo.findRunById(orgId, runId);
    if (!run) {
      throw new NotFoundException({
        code: 'RUN_NOT_FOUND',
        message: 'Reconciliation run not found',
      });
    }

    const { data, total } = await this.reconciliationRepo.findUnmatchedTransactions(
      orgId,
      run,
      query,
    );
    const limit = query.limit || 20;
    const page = query.page || 1;
    const totalPages = Math.ceil(total / limit) || (total === 0 ? 0 : 1);

    const mapped: UnmatchedTransactionItemDto[] = data.map((t) => ({
      id: t.id,
      sourceId: t.dataSourceId,
      externalId: t.externalId,
      amountMinor: t.amountMinor,
      currency: t.currency,
      transactionDate: t.transactionDate,
      reference: t.reference,
      status: t.status,
    }));

    return {
      data: mapped,
      total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
    };
  }

  async confirmMatch(orgId: string, matchId: string, userId: string): Promise<MatchDetailDto> {
    const updated = await this.reconciliationRepo.confirmMatch(orgId, matchId, userId);
    return {
      ...updated,
      classification: updated.classification as MatchClassification,
      status: updated.status as MatchStatus,
      transactionA: {
        id: updated.transactionA.id,
        dataSourceId: updated.transactionA.dataSourceId,
        externalId: updated.transactionA.externalId,
        amountMinor: updated.transactionA.amountMinor,
        currency: updated.transactionA.currency,
        transactionDate: updated.transactionA.transactionDate,
        reference: updated.transactionA.reference,
        externalTxnId: updated.transactionA.externalTxnId,
        merchantOrOrderId: updated.transactionA.merchantOrOrderId,
        txnType: updated.transactionA.txnType,
        status: updated.transactionA.status,
      },
      transactionB: {
        id: updated.transactionB.id,
        dataSourceId: updated.transactionB.dataSourceId,
        externalId: updated.transactionB.externalId,
        amountMinor: updated.transactionB.amountMinor,
        currency: updated.transactionB.currency,
        transactionDate: updated.transactionB.transactionDate,
        reference: updated.transactionB.reference,
        externalTxnId: updated.transactionB.externalTxnId,
        merchantOrOrderId: updated.transactionB.merchantOrOrderId,
        txnType: updated.transactionB.txnType,
        status: updated.transactionB.status,
      },
    };
  }

  async rejectMatch(
    orgId: string,
    matchId: string,
    userId: string,
    dto: RejectMatchDto,
  ): Promise<MatchDetailDto> {
    const updated = await this.reconciliationRepo.rejectMatch(orgId, matchId, userId, dto.reason);

    if (this.exceptionsService) {
      if (updated.transactionA.status === 'UNMATCHED') {
        await this.exceptionsService.createExceptionsForUnmatched(
          orgId,
          updated.runId,
          [updated.transactionA.id],
        );
      }
      if (updated.transactionB.status === 'UNMATCHED') {
        await this.exceptionsService.createExceptionsForUnmatched(
          orgId,
          updated.runId,
          [updated.transactionB.id],
        );
      }
    }

    return {
      ...updated,
      classification: updated.classification as MatchClassification,
      status: updated.status as MatchStatus,
      transactionA: {
        id: updated.transactionA.id,
        dataSourceId: updated.transactionA.dataSourceId,
        externalId: updated.transactionA.externalId,
        amountMinor: updated.transactionA.amountMinor,
        currency: updated.transactionA.currency,
        transactionDate: updated.transactionA.transactionDate,
        reference: updated.transactionA.reference,
        externalTxnId: updated.transactionA.externalTxnId,
        merchantOrOrderId: updated.transactionA.merchantOrOrderId,
        txnType: updated.transactionA.txnType,
        status: updated.transactionA.status,
      },
      transactionB: {
        id: updated.transactionB.id,
        dataSourceId: updated.transactionB.dataSourceId,
        externalId: updated.transactionB.externalId,
        amountMinor: updated.transactionB.amountMinor,
        currency: updated.transactionB.currency,
        transactionDate: updated.transactionB.transactionDate,
        reference: updated.transactionB.reference,
        externalTxnId: updated.transactionB.externalTxnId,
        merchantOrOrderId: updated.transactionB.merchantOrOrderId,
        txnType: updated.transactionB.txnType,
        status: updated.transactionB.status,
      },
    };
  }
}
