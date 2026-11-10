import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  AuditAction,
  AuditEntityType,
  JobType,
  NewMatch,
  ReconciliationRun,
  Transaction,
} from '@reconcilex/db';
import {
  MatchTransaction,
  matchTwoSets,
  matchThreeSets,
  matchNSets,
  MatchingConfig,
  SourceInput,
} from '@reconcilex/matching';
import { AuditService } from '../../audit/audit.service';
import { ExceptionsService } from '../../exceptions/exceptions.service';
import { JobsService } from '../../jobs/jobs.service';
import {
  ITransactionsRepository,
  TRANSACTIONS_REPOSITORY,
} from '../../transactions/repositories/transactions.repository.interface';
import {
  IReconciliationRepository,
  RECONCILIATION_REPOSITORY,
} from '../repositories/reconciliation.repository.interface';
import {
  IReconciliationJobService,
  ReconciliationJobOptions,
} from './reconciliation-job.interface';

@Injectable()
export class SyncReconciliationJobService implements IReconciliationJobService {
  private readonly logger = new Logger(SyncReconciliationJobService.name);

  constructor(
    @Inject(RECONCILIATION_REPOSITORY)
    private readonly reconciliationRepo: IReconciliationRepository,
    @Inject(TRANSACTIONS_REPOSITORY)
    private readonly transactionsRepo: ITransactionsRepository,
    @Optional()
    private readonly exceptionsService?: ExceptionsService,
    @Optional()
    private readonly jobsService?: JobsService,
    @Optional()
    private readonly auditService?: AuditService,
  ) {}

  async submitRun(
    run: ReconciliationRun,
    options?: ReconciliationJobOptions,
  ): Promise<{ jobId: string; status: string }> {
    const runId = run.id;
    const organizationId = run.organizationId;
    let jobId = runId;

    try {
      if (this.jobsService) {
        const job = await this.jobsService.createJob(organizationId, {
          jobType: JobType.RECONCILIATION_RUN,
          referenceType: 'RECONCILIATION_RUN',
          referenceId: runId,
          message: 'Reconciliation run started',
        });
        jobId = job.id;
        await this.jobsService.markRunning(organizationId, job.id, 'Comparing transaction datasets', 20);
      }

      // 1. Mark run status as PROCESSING
      await this.reconciliationRepo.updateRun(runId, { status: 'PROCESSING' });

      // 2. Parse date range
      const configObj = (run.config || {}) as Record<string, unknown>;
      const rawDateFrom =
        options?.dateFrom ||
        (configObj.dateFrom as string) ||
        new Date(0).toISOString().split('T')[0];
      const rawDateTo =
        options?.dateTo ||
        (configObj.dateTo as string) ||
        new Date().toISOString().split('T')[0];

      const dateFrom = new Date(
        rawDateFrom.includes('T') ? rawDateFrom : `${rawDateFrom}T00:00:00.000Z`,
      );
      const dateTo = new Date(
        rawDateTo.includes('T') ? rawDateTo : `${rawDateTo}T23:59:59.999Z`,
      );

      const isFourSource = run.reconciliationType === 'FOUR_SOURCE' || !!run.sourceDId;
      const isThreeSource = !isFourSource && (run.reconciliationType === 'THREE_SOURCE' || !!run.sourceCId);

      // 3. Fetch eligible transactions (not already MATCHED)
      const txnsA = await this.transactionsRepo.findEligibleForReconciliation(
        organizationId,
        run.sourceAId,
        dateFrom,
        dateTo,
      );

      const txnsB = await this.transactionsRepo.findEligibleForReconciliation(
        organizationId,
        run.sourceBId,
        dateFrom,
        dateTo,
      );

      const txnsC = (isThreeSource || isFourSource) && run.sourceCId
        ? await this.transactionsRepo.findEligibleForReconciliation(
            organizationId,
            run.sourceCId,
            dateFrom,
            dateTo,
          )
        : [];

      const txnsD = isFourSource && run.sourceDId
        ? await this.transactionsRepo.findEligibleForReconciliation(
            organizationId,
            run.sourceDId,
            dateFrom,
            dateTo,
          )
        : [];

      // 4. Map into MatchTransaction
      const mapToMatch = (t: Transaction): MatchTransaction => ({
        id: t.id,
        amountMinor: t.amountMinor,
        currency: t.currency,
        transactionDate: t.transactionDate,
        reference: t.reference,
        externalId: t.externalId,
        externalTxnId: t.externalTxnId,
        merchantOrOrderId: t.merchantOrOrderId,
        txnType: t.txnType,
      });

      const setA = txnsA.map(mapToMatch);
      const setB = txnsB.map(mapToMatch);
      const setC = txnsC.map(mapToMatch);
      const setD = txnsD.map(mapToMatch);

      const matchConfig =
        options?.matchingConfig || (configObj.matchingConfig as MatchingConfig | undefined);

      const now = new Date();
      const newMatches: NewMatch[] = [];
      const exactTxnIds: string[] = [];
      const potentialTxnIds: string[] = [];
      let unmatchedIds: string[] = [];

      let exactCount = 0;
      let potentialCount = 0;
      let fullyMatchedCount = 0;
      let partiallyMatchedCount = 0;
      let discrepancyCount = 0;

      if (isFourSource) {
        // Execute generalized multi-source / four-source engine
        const sourcesInput: SourceInput[] = [
          { id: run.sourceAId, name: 'Source A', transactions: setA },
          { id: run.sourceBId, name: 'Source B', transactions: setB },
          { id: run.sourceCId || 'src-c', name: 'Source C', transactions: setC },
          { id: run.sourceDId!, name: 'Source D', transactions: setD },
        ];

        const nResult = matchNSets(sourcesInput, matchConfig);

        fullyMatchedCount = nResult.statistics.fullyMatchedCount;
        partiallyMatchedCount = nResult.statistics.partiallyMatchedCount;
        discrepancyCount =
          nResult.statistics.amountMismatchCount +
          nResult.statistics.dateMismatchCount;
        potentialCount =
          nResult.statistics.potentialMatchCount +
          partiallyMatchedCount +
          discrepancyCount;
        exactCount = fullyMatchedCount;

        for (const g of nResult.matchGroups) {
          const isConfirmed = g.classification === 'FULLY_MATCHED';
          const participatingIds = [
            g.transactionAId,
            g.transactionBId,
            g.transactionCId,
            g.transactionDId,
          ].filter((id): id is string => typeof id === 'string' && id.length > 0);

          if (isConfirmed) {
            exactTxnIds.push(...participatingIds);
          } else {
            potentialTxnIds.push(...participatingIds);
          }

          newMatches.push({
            organizationId,
            runId,
            reconciliationType: 'FOUR_SOURCE',
            transactionAId: g.transactionAId ?? null,
            transactionBId: g.transactionBId ?? null,
            transactionCId: g.transactionCId ?? null,
            transactionDId: g.transactionDId ?? null,
            classification: g.classification,
            score: g.score,
            reasons: {
              reasonCodes: g.reasons,
              explanation: g.explanation,
              sourceStatus: g.sourceStatusBySourceId,
            },
            discrepancyDetails: g.discrepancies.length > 0 ? g.discrepancies : null,
            status: isConfirmed ? 'CONFIRMED' : 'PENDING',
            confirmedBy: isConfirmed ? (run.createdBy ?? null) : null,
            confirmedAt: isConfirmed ? now : null,
          });
        }

        unmatchedIds = Object.values(nResult.unmatchedBySourceId).flatMap((txns) =>
          txns.map((t) => t.id),
        );
      } else if (isThreeSource) {
        // Execute three-source matching engine
        const threeResult = matchThreeSets(setA, setB, setC, matchConfig);

        fullyMatchedCount = threeResult.statistics.fullyMatchedCount;
        partiallyMatchedCount = threeResult.statistics.partiallyMatchedCount;
        discrepancyCount =
          threeResult.statistics.amountMismatchCount +
          threeResult.statistics.dateMismatchCount +
          threeResult.statistics.referenceMismatchCount;
        potentialCount =
          threeResult.statistics.potentialMatchCount +
          partiallyMatchedCount +
          discrepancyCount;
        exactCount = fullyMatchedCount;

        for (const g of threeResult.matchGroups) {
          const isConfirmed = g.classification === 'FULLY_MATCHED';
          const participatingIds = [g.transactionAId, g.transactionBId, g.transactionCId].filter(
            (id): id is string => typeof id === 'string' && id.length > 0,
          );

          if (isConfirmed) {
            exactTxnIds.push(...participatingIds);
          } else {
            potentialTxnIds.push(...participatingIds);
          }

          newMatches.push({
            organizationId,
            runId,
            reconciliationType: 'THREE_SOURCE',
            transactionAId: g.transactionAId ?? null,
            transactionBId: g.transactionBId ?? null,
            transactionCId: g.transactionCId ?? null,
            classification: g.classification,
            score: g.score,
            reasons: {
              reasonCodes: g.reasons,
              explanation: g.explanation,
              sourceStatus: g.sourceStatus,
            },
            discrepancyDetails: g.discrepancies.length > 0 ? g.discrepancies : null,
            status: isConfirmed ? 'CONFIRMED' : 'PENDING',
            confirmedBy: isConfirmed ? (run.createdBy ?? null) : null,
            confirmedAt: isConfirmed ? now : null,
          });
        }

        unmatchedIds = [
          ...threeResult.unmatchedA.map((t) => t.id),
          ...threeResult.unmatchedB.map((t) => t.id),
          ...threeResult.unmatchedC.map((t) => t.id),
        ];
      } else {
        // Execute pairwise two-source matching engine (100% backward compatible)
        const matchResult = matchTwoSets(setA, setB, matchConfig);

        for (const accepted of matchResult.acceptedMatches) {
          const isExact = accepted.classification === 'EXACT';
          if (isExact) {
            exactCount++;
            exactTxnIds.push(accepted.transactionAId, accepted.transactionBId);
            newMatches.push({
              organizationId,
              runId,
              reconciliationType: 'TWO_SOURCE',
              transactionAId: accepted.transactionAId,
              transactionBId: accepted.transactionBId,
              transactionCId: null,
              classification: 'EXACT',
              score: accepted.score,
              reasons: {
                reasonCodes: accepted.reasons,
                contributions: accepted.contributions,
                dateDifferenceDays: accepted.dateDifferenceDays,
                metadata: accepted.metadata,
              },
              status: 'CONFIRMED',
              confirmedBy: run.createdBy ?? null,
              confirmedAt: now,
            });
          } else {
            potentialCount++;
            potentialTxnIds.push(accepted.transactionAId, accepted.transactionBId);
            newMatches.push({
              organizationId,
              runId,
              reconciliationType: 'TWO_SOURCE',
              transactionAId: accepted.transactionAId,
              transactionBId: accepted.transactionBId,
              transactionCId: null,
              classification: 'POTENTIAL',
              score: accepted.score,
              reasons: {
                tier: accepted.classification,
                reasonCodes: accepted.reasons,
                contributions: accepted.contributions,
                dateDifferenceDays: accepted.dateDifferenceDays,
                metadata: accepted.metadata,
              },
              status: 'PENDING',
            });
          }
        }

        unmatchedIds = [...matchResult.unmatchedIdsA, ...matchResult.unmatchedIdsB];
      }

      // 7. Persist matches
      let createdMatches: any[] = [];
      if (newMatches.length > 0) {
        createdMatches = await this.reconciliationRepo.createMatches(newMatches);
      }

      // 8. Update transaction statuses
      if (exactTxnIds.length > 0) {
        await this.transactionsRepo.updateStatuses(organizationId, exactTxnIds, 'MATCHED');
      }

      if (potentialTxnIds.length > 0) {
        await this.transactionsRepo.updateStatuses(
          organizationId,
          potentialTxnIds,
          'POTENTIAL_MATCH',
        );
      }

      if (unmatchedIds.length > 0) {
        await this.transactionsRepo.updateStatuses(organizationId, unmatchedIds, 'UNMATCHED');
      }

      // 9. Update run with counters and mark COMPLETED
      const updatedConfig = {
        ...configObj,
        unmatchedTransactionIds: unmatchedIds,
      };

      await this.reconciliationRepo.updateRun(runId, {
        status: 'COMPLETED',
        totalSourceA: txnsA.length,
        totalSourceB: txnsB.length,
        totalSourceC: txnsC.length,
        totalSourceD: txnsD.length,
        exactMatchCount: exactCount,
        potentialMatchCount: potentialCount,
        fullyMatchedCount,
        partiallyMatchedCount,
        discrepancyCount,
        unmatchedCount: unmatchedIds.length,
        config: updatedConfig,
        completedAt: now,
      });

      // 10. Automatically create OPEN exceptions for unmatched transactions & discrepancies
      if (this.exceptionsService) {
        if (unmatchedIds.length > 0) {
          await this.exceptionsService.createExceptionsForUnmatched(
            organizationId,
            runId,
            unmatchedIds,
          );
        }

        // For 3-source and 4-source discrepancy or partial matches, create dedicated discrepancy exceptions
        if ((isThreeSource || isFourSource) && createdMatches.length > 0) {
          for (const m of createdMatches) {
            if (
              m.classification === 'PARTIALLY_MATCHED' ||
              m.classification === 'AMOUNT_MISMATCH' ||
              m.classification === 'DATE_MISMATCH' ||
              m.classification === 'REFERENCE_MISMATCH'
            ) {
              const primaryTxnId =
                m.transactionAId || m.transactionBId || m.transactionCId || m.transactionDId;
              await this.exceptionsService.createExceptionForDiscrepancy(
                organizationId,
                runId,
                m.id,
                m.classification,
                m.discrepancyDetails,
                primaryTxnId,
              );
            }
          }
        }
      }

      if (this.jobsService && jobId !== runId) {
        await this.jobsService.markCompleted(
          organizationId,
          jobId,
          {
            totalSourceA: txnsA.length,
            totalSourceB: txnsB.length,
            totalSourceC: txnsC.length,
            exactMatchCount: exactCount,
            potentialMatchCount: potentialCount,
            fullyMatchedCount,
            partiallyMatchedCount,
            discrepancyCount,
            unmatchedCount: unmatchedIds.length,
          },
          'Reconciliation run completed successfully',
        );
      }

      if (this.auditService) {
        await this.auditService.logSystemAction(
          organizationId,
          AuditAction.RECONCILIATION_RUN_COMPLETED,
          AuditEntityType.RECONCILIATION_RUN,
          runId,
          {
            reconciliationType: run.reconciliationType,
            exactMatchCount: exactCount,
            potentialMatchCount: potentialCount,
            fullyMatchedCount,
            partiallyMatchedCount,
            discrepancyCount,
            unmatchedCount: unmatchedIds.length,
          },
        );
      }

      return { jobId, status: 'COMPLETED' };
    } catch (error) {
      this.logger.error(
        `Failed processing reconciliation run ${runId}: ${(error as Error).message}`,
        (error as Error).stack,
      );

      await this.reconciliationRepo.updateRun(runId, {
        status: 'FAILED',
        completedAt: new Date(),
        config: {
          ...((run.config as Record<string, unknown>) || {}),
          error: (error as Error).message,
        },
      });

      if (this.jobsService && jobId !== runId) {
        await this.jobsService.markFailed(organizationId, jobId, error, (error as Error).message);
      }

      if (this.auditService) {
        await this.auditService.logSystemAction(
          organizationId,
          AuditAction.RECONCILIATION_RUN_FAILED,
          AuditEntityType.RECONCILIATION_RUN,
          runId,
          { error: (error as Error).message },
        );
      }

      return { jobId, status: 'FAILED' };
    }
  }
}
