import {
  DataSource,
  Match,
  NewMatch,
  NewReconciliationRun,
  ReconciliationRun,
  Transaction,
} from '@reconcilex/db';
import { QueryMatchesDto } from '../dto/query-matches.dto';
import { QueryReconciliationRunsDto } from '../dto/query-reconciliation-runs.dto';
import { QueryUnmatchedDto } from '../dto/query-unmatched.dto';

export const RECONCILIATION_REPOSITORY = 'RECONCILIATION_REPOSITORY';

export interface MatchWithTransactions extends Match {
  transactionA?: Transaction | null;
  transactionB?: Transaction | null;
  transactionC?: Transaction | null;
  transactionD?: Transaction | null;
}

export interface ReconciliationRunWithSources extends ReconciliationRun {
  sourceA: DataSource;
  sourceB: DataSource;
  sourceC?: DataSource | null;
  sourceD?: DataSource | null;
}

export interface IReconciliationRepository {
  createRun(run: NewReconciliationRun): Promise<ReconciliationRun>;
  updateRun(id: string, updates: Partial<ReconciliationRun>): Promise<ReconciliationRun>;
  findRunById(orgId: string, runId: string): Promise<ReconciliationRun | null>;
  findRunDetailById(orgId: string, runId: string): Promise<ReconciliationRunWithSources | null>;
  findRunByIdempotencyKey(orgId: string, key: string): Promise<ReconciliationRun | null>;
  findActiveRunForSources(
    orgId: string,
    sourceAId: string,
    sourceBId: string,
    sourceCId?: string,
    sourceDId?: string,
  ): Promise<ReconciliationRun | null>;
  getNextDisplayId(orgId: string, dateStr: string): Promise<string>;
  findRuns(
    orgId: string,
    query: QueryReconciliationRunsDto,
  ): Promise<{ data: ReconciliationRun[]; total: number }>;
  createMatches(newMatches: NewMatch[]): Promise<Match[]>;
  findMatches(
    orgId: string,
    runId: string,
    query: QueryMatchesDto,
  ): Promise<{ data: MatchWithTransactions[]; total: number }>;
  findMatchById(orgId: string, matchId: string): Promise<MatchWithTransactions | null>;
  confirmMatch(orgId: string, matchId: string, userId: string): Promise<MatchWithTransactions>;
  rejectMatch(
    orgId: string,
    matchId: string,
    userId: string,
    reason?: string,
  ): Promise<MatchWithTransactions>;
  findUnmatchedTransactions(
    orgId: string,
    run: ReconciliationRun,
    query: QueryUnmatchedDto,
  ): Promise<{ data: Transaction[]; total: number }>;
}
