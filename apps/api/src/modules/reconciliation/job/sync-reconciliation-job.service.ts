import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { NewMatch, ReconciliationRun, Transaction } from '@reconcilex/db';
import { MatchTransaction, matchTwoSets, MatchingConfig } from '@reconcilex/matching';
import { ExceptionsService } from '../../exceptions/exceptions.service';
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
  ) {}

  async submitRun(
    run: ReconciliationRun,
    options?: ReconciliationJobOptions,
  ): Promise<{ jobId: string; status: string }> {
    const runId = run.id;
    const organizationId = run.organizationId;

    try {
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

      // 5. Execute matching engine
      const matchConfig =
        options?.matchingConfig || (configObj.matchingConfig as MatchingConfig | undefined);
      const matchResult = matchTwoSets(setA, setB, matchConfig);

      // 6. Partition matches
      const newMatches: NewMatch[] = [];
      const exactTxnIds: string[] = [];
      const potentialTxnIds: string[] = [];

      let exactCount = 0;
      let potentialCount = 0;

      const now = new Date();

      for (const accepted of matchResult.acceptedMatches) {
        const isExact = accepted.classification === 'EXACT';
        if (isExact) {
          exactCount++;
          exactTxnIds.push(accepted.transactionAId, accepted.transactionBId);
          newMatches.push({
            organizationId,
            runId,
            transactionAId: accepted.transactionAId,
            transactionBId: accepted.transactionBId,
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
            transactionAId: accepted.transactionAId,
            transactionBId: accepted.transactionBId,
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

      const unmatchedIds = [...matchResult.unmatchedIdsA, ...matchResult.unmatchedIdsB];

      // 7. Persist matches
      if (newMatches.length > 0) {
        await this.reconciliationRepo.createMatches(newMatches);
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
        exactMatchCount: exactCount,
        potentialMatchCount: potentialCount,
        unmatchedCount: unmatchedIds.length,
        config: updatedConfig,
        completedAt: now,
      });

      // 10. Automatically create OPEN exceptions for unmatched transactions
      if (unmatchedIds.length > 0 && this.exceptionsService) {
        await this.exceptionsService.createExceptionsForUnmatched(
          organizationId,
          runId,
          unmatchedIds,
        );
      }

      return { jobId: runId, status: 'COMPLETED' };
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

      return { jobId: runId, status: 'FAILED' };
    }
  }
}
