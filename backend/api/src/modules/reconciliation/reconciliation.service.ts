import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  AuditAction,
  AuditEntityType,
  MatchClassification,
  MatchStatus,
  ReconciliationRunStatus,
} from '@reconcilex/db';
import { AuditService } from '../audit/audit.service';
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
    @Optional()
    private readonly auditService?: AuditService,
  ) {}

  async createRun(
    orgId: string,
    userId: string,
    dto: CreateReconciliationRunDto,
    idempotencyKey?: string,
  ): Promise<CreateReconciliationRunResponseDto> {
    // 1. Validate distinct data sources
    const isFourSource = dto.reconciliationType === 'FOUR_SOURCE' || !!dto.sourceD;
    const isThreeSource = !isFourSource && (dto.reconciliationType === 'THREE_SOURCE' || !!dto.sourceC);

    if (dto.sourceA === dto.sourceB) {
      throw new BadRequestException({
        code: 'SAME_SOURCE',
        message: 'Source A and Source B must be different.',
      });
    }

    if (isFourSource) {
      if (!dto.sourceC || !dto.sourceD) {
        throw new BadRequestException({
          code: 'MISSING_SOURCES',
          message: 'Source C and Source D are both required for four-source reconciliation.',
        });
      }
      const uniqueSources = new Set([dto.sourceA, dto.sourceB, dto.sourceC, dto.sourceD]);
      if (uniqueSources.size !== 4) {
        throw new BadRequestException({
          code: 'SAME_SOURCE',
          message: 'All four data sources (Source A, Source B, Source C, Source D) must be unique.',
        });
      }
    } else if (isThreeSource) {
      if (!dto.sourceC) {
        throw new BadRequestException({
          code: 'MISSING_SOURCE_C',
          message: 'Source C is required for three-source reconciliation.',
        });
      }
      if (dto.sourceA === dto.sourceC || dto.sourceB === dto.sourceC) {
        throw new BadRequestException({
          code: 'SAME_SOURCE',
          message: 'All three data sources (Source A, Source B, Source C) must be different.',
        });
      }
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
    const sourceC =
      (isThreeSource || isFourSource) && dto.sourceC
        ? await this.dataSourcesRepo.findById(orgId, dto.sourceC)
        : null;
    const sourceD =
      isFourSource && dto.sourceD ? await this.dataSourcesRepo.findById(orgId, dto.sourceD) : null;

    if (!sourceA || !sourceB || ((isThreeSource || isFourSource) && !sourceC) || (isFourSource && !sourceD)) {
      throw new NotFoundException({
        code: 'SOURCE_NOT_FOUND',
        message: 'One or more data sources were not found in this organization.',
      });
    }

    // 4. Verify data sources are active
    if (
      sourceA.status !== 'ACTIVE' ||
      sourceB.status !== 'ACTIVE' ||
      (sourceC && sourceC.status !== 'ACTIVE') ||
      (sourceD && sourceD.status !== 'ACTIVE')
    ) {
      throw new BadRequestException({
        code: 'INVALID_SOURCE',
        message: 'All selected data sources must be active.',
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
          (existing.sourceCId || undefined) === (dto.sourceC || undefined) &&
          (existing.sourceDId || undefined) === (dto.sourceD || undefined) &&
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

    // 6. Prevent duplicate active runs for this source set
    const activeRun = await this.reconciliationRepo.findActiveRunForSources(
      orgId,
      dto.sourceA,
      dto.sourceB,
      dto.sourceC,
      dto.sourceD,
    );
    if (activeRun) {
      throw new ConflictException({
        code: 'RUN_ALREADY_PROCESSING',
        message: 'A reconciliation run is already active for this data source configuration.',
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

    const runType = isFourSource
      ? 'FOUR_SOURCE'
      : isThreeSource
        ? 'THREE_SOURCE'
        : 'TWO_SOURCE';

    const snapshotConfig = {
      reconciliationType: runType,
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
      reconciliationType: runType,
      sourceAId: dto.sourceA,
      sourceBId: dto.sourceB,
      sourceCId: dto.sourceC || null,
      sourceDId: dto.sourceD || null,
      status: 'PENDING',
      startedAt: now,
      config: snapshotConfig,
      totalSourceA: 0,
      totalSourceB: 0,
      totalSourceC: 0,
      totalSourceD: 0,
      exactMatchCount: 0,
      potentialMatchCount: 0,
      fullyMatchedCount: 0,
      partiallyMatchedCount: 0,
      discrepancyCount: 0,
      unmatchedCount: 0,
      idempotencyKey: idempotencyKey || null,
      createdBy: userId,
    });

    if (this.auditService) {
      await this.auditService.logUserAction(
        orgId,
        userId,
        AuditAction.RECONCILIATION_RUN_CREATED,
        AuditEntityType.RECONCILIATION_RUN,
        newRun.id,
        {
          displayId: newRun.displayId,
          reconciliationType: newRun.reconciliationType,
          sourceAId: dto.sourceA,
          sourceBId: dto.sourceB,
          sourceCId: dto.sourceC,
          dateFrom: dto.dateFrom,
          dateTo: dto.dateTo,
        },
      );
    }

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
      sourceC: run.sourceC
        ? {
            id: run.sourceC.id,
            name: run.sourceC.name,
            type: run.sourceC.type,
            status: run.sourceC.status,
          }
        : null,
      sourceD: run.sourceD
        ? {
            id: run.sourceD.id,
            name: run.sourceD.name,
            type: run.sourceD.type,
            status: run.sourceD.status,
          }
        : null,
    };
  }

  private mapTransactionToDto(t?: any) {
    if (!t) return null;
    return {
      id: t.id,
      dataSourceId: t.dataSourceId,
      externalId: t.externalId,
      amountMinor: t.amountMinor,
      currency: t.currency,
      transactionDate: t.transactionDate,
      reference: t.reference,
      externalTxnId: t.externalTxnId,
      merchantOrOrderId: t.merchantOrOrderId,
      txnType: t.txnType,
      status: t.status,
      screenshotFileId: t.screenshotFileId || null,
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
      reconciliationType: m.reconciliationType,
      classification: m.classification as MatchClassification,
      status: m.status as MatchStatus,
      transactionA: this.mapTransactionToDto(m.transactionA),
      transactionB: this.mapTransactionToDto(m.transactionB),
      transactionC: this.mapTransactionToDto(m.transactionC),
      transactionD: this.mapTransactionToDto(m.transactionD),
      discrepancyDetails: (m.discrepancyDetails as any) || null,
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
      screenshotFileId: t.screenshotFileId || null,
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

    if (this.auditService) {
      await this.auditService.logUserAction(
        orgId,
        userId,
        AuditAction.MATCH_CONFIRMED,
        AuditEntityType.MATCH,
        updated.id,
        {
          runId: updated.runId,
          transactionAId: updated.transactionA?.id,
          transactionBId: updated.transactionB?.id,
          transactionCId: updated.transactionC?.id,
          transactionDId: updated.transactionD?.id,
          score: updated.score,
        },
      );
    }

    return {
      ...updated,
      reconciliationType: updated.reconciliationType,
      classification: updated.classification as MatchClassification,
      status: updated.status as MatchStatus,
      transactionA: this.mapTransactionToDto(updated.transactionA),
      transactionB: this.mapTransactionToDto(updated.transactionB),
      transactionC: this.mapTransactionToDto(updated.transactionC),
      transactionD: this.mapTransactionToDto(updated.transactionD),
      discrepancyDetails: (updated.discrepancyDetails as any) || null,
    };
  }

  async rejectMatch(
    orgId: string,
    matchId: string,
    userId: string,
    dto: RejectMatchDto,
  ): Promise<MatchDetailDto> {
    const updated = await this.reconciliationRepo.rejectMatch(orgId, matchId, userId, dto.reason);

    if (this.auditService) {
      await this.auditService.logUserAction(
        orgId,
        userId,
        AuditAction.MATCH_REJECTED,
        AuditEntityType.MATCH,
        updated.id,
        {
          runId: updated.runId,
          transactionAId: updated.transactionA?.id,
          transactionBId: updated.transactionB?.id,
          transactionCId: updated.transactionC?.id,
          transactionDId: updated.transactionD?.id,
          reason: dto.reason,
        },
      );
    }

    if (this.exceptionsService) {
      if (updated.transactionA && updated.transactionA.status === 'UNMATCHED') {
        await this.exceptionsService.createExceptionsForUnmatched(
          orgId,
          updated.runId,
          [updated.transactionA.id],
        );
      }
      if (updated.transactionB && updated.transactionB.status === 'UNMATCHED') {
        await this.exceptionsService.createExceptionsForUnmatched(
          orgId,
          updated.runId,
          [updated.transactionB.id],
        );
      }
      if (updated.transactionC && updated.transactionC.status === 'UNMATCHED') {
        await this.exceptionsService.createExceptionsForUnmatched(
          orgId,
          updated.runId,
          [updated.transactionC.id],
        );
      }
      if (updated.transactionD && updated.transactionD.status === 'UNMATCHED') {
        await this.exceptionsService.createExceptionsForUnmatched(
          orgId,
          updated.runId,
          [updated.transactionD.id],
        );
      }
    }

    return {
      ...updated,
      reconciliationType: updated.reconciliationType,
      classification: updated.classification as MatchClassification,
      status: updated.status as MatchStatus,
      transactionA: this.mapTransactionToDto(updated.transactionA),
      transactionB: this.mapTransactionToDto(updated.transactionB),
      transactionC: this.mapTransactionToDto(updated.transactionC),
      transactionD: this.mapTransactionToDto(updated.transactionD),
      discrepancyDetails: (updated.discrepancyDetails as any) || null,
    };
  }
}
