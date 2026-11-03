import { ReconciliationRun } from '@reconcilex/db';
import { MatchingConfig } from '@reconcilex/matching';

export const RECONCILIATION_JOB_SERVICE = 'RECONCILIATION_JOB_SERVICE';

export interface ReconciliationJobOptions {
  matchingConfig?: MatchingConfig;
  dateFrom?: string;
  dateTo?: string;
}

export interface IReconciliationJobService {
  submitRun(
    run: ReconciliationRun,
    options?: ReconciliationJobOptions,
  ): Promise<{ jobId: string; status: string }>;
}
