import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DataSource,
  Match,
  NewMatch,
  NewReconciliationRun,
  ReconciliationRun,
  Transaction,
} from '@reconcilex/db';
import { randomUUID } from 'crypto';
import { InMemoryDataSourcesRepository } from '../../data-sources/repositories/in-memory-data-sources.repository';
import { InMemoryTransactionsRepository } from '../../transactions/repositories/in-memory-transactions.repository';
import { QueryMatchesDto } from '../dto/query-matches.dto';
import { QueryReconciliationRunsDto } from '../dto/query-reconciliation-runs.dto';
import { QueryUnmatchedDto } from '../dto/query-unmatched.dto';
import {
  IReconciliationRepository,
  MatchWithTransactions,
  ReconciliationRunWithSources,
} from './reconciliation.repository.interface';

@Injectable()
export class InMemoryReconciliationRepository implements IReconciliationRepository {
  public runs: ReconciliationRun[] = [];
  public matches: Match[] = [];

  constructor(
    private readonly dataSourcesRepo?: InMemoryDataSourcesRepository,
    private readonly transactionsRepo?: InMemoryTransactionsRepository,
  ) {}

  async createRun(newRun: NewReconciliationRun): Promise<ReconciliationRun> {
    const now = new Date();
    const run: ReconciliationRun = {
      id: newRun.id || randomUUID(),
      organizationId: newRun.organizationId,
      displayId: newRun.displayId,
      reconciliationType: newRun.reconciliationType || 'TWO_SOURCE',
      sourceAId: newRun.sourceAId,
      sourceBId: newRun.sourceBId,
      sourceCId: newRun.sourceCId || null,
      status: newRun.status || 'PENDING',
      startedAt: newRun.startedAt instanceof Date ? newRun.startedAt : now,
      completedAt: newRun.completedAt instanceof Date ? newRun.completedAt : null,
      config: (newRun.config as Record<string, unknown>) || {},
      totalSourceA: newRun.totalSourceA ?? 0,
      totalSourceB: newRun.totalSourceB ?? 0,
      totalSourceC: newRun.totalSourceC ?? 0,
      exactMatchCount: newRun.exactMatchCount ?? 0,
      potentialMatchCount: newRun.potentialMatchCount ?? 0,
      fullyMatchedCount: newRun.fullyMatchedCount ?? 0,
      partiallyMatchedCount: newRun.partiallyMatchedCount ?? 0,
      discrepancyCount: newRun.discrepancyCount ?? 0,
      unmatchedCount: newRun.unmatchedCount ?? 0,
      idempotencyKey: newRun.idempotencyKey ?? null,
      createdBy: newRun.createdBy ?? null,
      createdAt: newRun.createdAt instanceof Date ? newRun.createdAt : now,
      updatedAt: newRun.updatedAt instanceof Date ? newRun.updatedAt : now,
    };
    this.runs.push(run);
    return { ...run };
  }

  async updateRun(id: string, updates: Partial<ReconciliationRun>): Promise<ReconciliationRun> {
    const run = this.runs.find((r) => r.id === id);
    if (!run) {
      throw new NotFoundException({
        code: 'RUN_NOT_FOUND',
        message: 'Reconciliation run not found',
      });
    }

    Object.assign(run, updates);
    run.updatedAt = new Date();
    return { ...run };
  }

  async findRunById(orgId: string, runId: string): Promise<ReconciliationRun | null> {
    const run = this.runs.find((r) => r.organizationId === orgId && r.id === runId);
    return run ? { ...run } : null;
  }

  async findRunDetailById(
    orgId: string,
    runId: string,
  ): Promise<ReconciliationRunWithSources | null> {
    const run = await this.findRunById(orgId, runId);
    if (!run) return null;

    let sourceA: DataSource | null = null;
    let sourceB: DataSource | null = null;
    let sourceC: DataSource | null = null;

    if (this.dataSourcesRepo) {
      sourceA = await this.dataSourcesRepo.findById(orgId, run.sourceAId);
      sourceB = await this.dataSourcesRepo.findById(orgId, run.sourceBId);
      if (run.sourceCId) {
        sourceC = await this.dataSourcesRepo.findById(orgId, run.sourceCId);
      }
    }

    const defaultSource = (id: string): DataSource => ({
      id,
      organizationId: orgId,
      name: `Source ${id.slice(0, 8)}`,
      type: 'OTHER',
      direction: 'INCOMING',
      columnMapping: {
        external_id: 'external_id',
        amount: 'amount',
        date: 'date',
        currency: 'currency',
      },
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    return {
      ...run,
      sourceA: sourceA || defaultSource(run.sourceAId),
      sourceB: sourceB || defaultSource(run.sourceBId),
      sourceC: sourceC || (run.sourceCId ? defaultSource(run.sourceCId) : null),
    };
  }

  async findRunByIdempotencyKey(orgId: string, key: string): Promise<ReconciliationRun | null> {
    const run = this.runs.find((r) => r.organizationId === orgId && r.idempotencyKey === key);
    return run ? { ...run } : null;
  }

  async findActiveRunForSources(
    orgId: string,
    sourceAId: string,
    sourceBId: string,
    sourceCId?: string,
  ): Promise<ReconciliationRun | null> {
    const activeStatuses = ['PENDING', 'PROCESSING'];
    const targetSources = new Set([sourceAId, sourceBId, ...(sourceCId ? [sourceCId] : [])]);

    const run = this.runs.find((r) => {
      if (r.organizationId !== orgId || !activeStatuses.includes(r.status)) return false;
      const runSources = new Set([r.sourceAId, r.sourceBId, ...(r.sourceCId ? [r.sourceCId] : [])]);
      return runSources.size === targetSources.size && [...targetSources].every((s) => runSources.has(s));
    });
    return run ? { ...run } : null;
  }

  async getNextDisplayId(orgId: string, dateStr: string): Promise<string> {
    const prefix = `RUN-${dateStr}-`;
    const matching = this.runs.filter(
      (r) => r.organizationId === orgId && r.displayId.startsWith(prefix),
    );

    let maxNum = 0;
    for (const r of matching) {
      const part = r.displayId.replace(prefix, '');
      const parsed = parseInt(part, 10);
      if (!isNaN(parsed) && parsed > maxNum) {
        maxNum = parsed;
      }
    }

    const nextNum = maxNum + 1;
    const padded = String(nextNum).padStart(3, '0');
    return `${prefix}${padded}`;
  }

  async findRuns(
    orgId: string,
    query: QueryReconciliationRunsDto,
  ): Promise<{ data: ReconciliationRun[]; total: number }> {
    let filtered = this.runs.filter((r) => r.organizationId === orgId);

    if (query.status) {
      filtered = filtered.filter((r) => r.status === query.status);
    }

    if (query.sourceId) {
      filtered = filtered.filter(
        (r) => r.sourceAId === query.sourceId || r.sourceBId === query.sourceId,
      );
    }

    if (query.dateFrom) {
      const fromMs = new Date(query.dateFrom).getTime();
      filtered = filtered.filter((r) => new Date(r.createdAt).getTime() >= fromMs);
    }

    if (query.dateTo) {
      const toMs = new Date(
        query.dateTo.includes('T') ? query.dateTo : `${query.dateTo}T23:59:59.999Z`,
      ).getTime();
      filtered = filtered.filter((r) => new Date(r.createdAt).getTime() <= toMs);
    }

    // Sort
    const sortField = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    filtered.sort((a, b) => {
      const timeA = new Date(a[sortField]).getTime();
      const timeB = new Date(b[sortField]).getTime();
      return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
    });

    const total = filtered.length;
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;
    const data = filtered.slice(offset, offset + limit).map((r) => ({ ...r }));

    return { data, total };
  }

  async createMatches(newMatches: NewMatch[]): Promise<Match[]> {
    const created: Match[] = [];
    const now = new Date();

    for (const nm of newMatches) {
      const match: Match = {
        id: nm.id || randomUUID(),
        organizationId: nm.organizationId,
        runId: nm.runId,
        reconciliationType: nm.reconciliationType || 'TWO_SOURCE',
        transactionAId: nm.transactionAId || null,
        transactionBId: nm.transactionBId || null,
        transactionCId: nm.transactionCId || null,
        classification: nm.classification,
        score: nm.score,
        reasons: (nm.reasons as Record<string, unknown>) || {},
        discrepancyDetails: nm.discrepancyDetails || null,
        status: nm.status || 'PENDING',
        confirmedBy: nm.confirmedBy ?? null,
        confirmedAt: nm.confirmedAt instanceof Date ? nm.confirmedAt : null,
        rejectedBy: nm.rejectedBy ?? null,
        rejectedAt: nm.rejectedAt instanceof Date ? nm.rejectedAt : null,
        createdAt: nm.createdAt instanceof Date ? nm.createdAt : now,
        updatedAt: nm.updatedAt instanceof Date ? nm.updatedAt : now,
      };
      this.matches.push(match);
      created.push({ ...match });
    }

    return created;
  }

  async findMatches(
    orgId: string,
    runId: string,
    query: QueryMatchesDto,
  ): Promise<{ data: MatchWithTransactions[]; total: number }> {
    let filtered = this.matches.filter((m) => m.organizationId === orgId && m.runId === runId);

    if (query.classification) {
      filtered = filtered.filter((m) => m.classification === query.classification);
    }

    if (query.status) {
      filtered = filtered.filter((m) => m.status === query.status);
    }

    const total = filtered.length;
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;
    const pageMatches = filtered.slice(offset, offset + limit);

    const withTxns: MatchWithTransactions[] = [];
    for (const m of pageMatches) {
      let txnA: Transaction | null = null;
      let txnB: Transaction | null = null;
      let txnC: Transaction | null = null;

      if (this.transactionsRepo) {
        if (m.transactionAId) txnA = await this.transactionsRepo.findById(orgId, m.transactionAId);
        if (m.transactionBId) txnB = await this.transactionsRepo.findById(orgId, m.transactionBId);
        if (m.transactionCId) txnC = await this.transactionsRepo.findById(orgId, m.transactionCId);
      }

      withTxns.push({
        ...m,
        transactionA: txnA,
        transactionB: txnB,
        transactionC: txnC,
      });
    }

    return { data: withTxns, total };
  }

  async findMatchById(orgId: string, matchId: string): Promise<MatchWithTransactions | null> {
    const match = this.matches.find((m) => m.organizationId === orgId && m.id === matchId);
    if (!match) return null;

    let txnA: Transaction | null = null;
    let txnB: Transaction | null = null;
    let txnC: Transaction | null = null;

    if (this.transactionsRepo) {
      if (match.transactionAId) txnA = await this.transactionsRepo.findById(orgId, match.transactionAId);
      if (match.transactionBId) txnB = await this.transactionsRepo.findById(orgId, match.transactionBId);
      if (match.transactionCId) txnC = await this.transactionsRepo.findById(orgId, match.transactionCId);
    }

    return {
      ...match,
      transactionA: txnA,
      transactionB: txnB,
      transactionC: txnC,
    };
  }

  async confirmMatch(
    orgId: string,
    matchId: string,
    userId: string,
  ): Promise<MatchWithTransactions> {
    const match = this.matches.find((m) => m.organizationId === orgId && m.id === matchId);
    if (!match) {
      throw new NotFoundException({
        code: 'MATCH_NOT_FOUND',
        message: 'Match not found',
      });
    }

    if (match.classification !== 'POTENTIAL' && match.classification !== 'POTENTIAL_MATCH') {
      throw new BadRequestException({
        code: 'INVALID_MATCH_STATE',
        message: 'Only POTENTIAL matches can be confirmed or rejected.',
      });
    }

    if (match.status === 'CONFIRMED') {
      throw new ConflictException({
        code: 'MATCH_ALREADY_CONFIRMED',
        message: 'This match has already been confirmed.',
      });
    }

    if (match.status === 'REJECTED') {
      throw new ConflictException({
        code: 'MATCH_ALREADY_REJECTED',
        message: 'This match has already been rejected.',
      });
    }

    const txnIds = [match.transactionAId, match.transactionBId, match.transactionCId].filter(
      (id): id is string => typeof id === 'string' && id.length > 0,
    );

    // Check transactions
    if (this.transactionsRepo) {
      for (const id of txnIds) {
        const txn = await this.transactionsRepo.findById(orgId, id);
        if (txn?.status === 'MATCHED') {
          throw new ConflictException({
            code: 'TRANSACTION_ALREADY_MATCHED',
            message: 'One or more transactions in this match have already been matched.',
          });
        }
      }
    }

    const now = new Date();
    match.status = 'CONFIRMED';
    match.confirmedBy = userId;
    match.confirmedAt = now;
    match.updatedAt = now;

    if (this.transactionsRepo && txnIds.length > 0) {
      await this.transactionsRepo.updateStatuses(orgId, txnIds, 'MATCHED');
    }

    const updated = await this.findMatchById(orgId, matchId);
    return updated!;
  }

  async rejectMatch(
    orgId: string,
    matchId: string,
    userId: string,
    reason?: string,
  ): Promise<MatchWithTransactions> {
    const match = this.matches.find((m) => m.organizationId === orgId && m.id === matchId);
    if (!match) {
      throw new NotFoundException({
        code: 'MATCH_NOT_FOUND',
        message: 'Match not found',
      });
    }

    if (match.classification !== 'POTENTIAL' && match.classification !== 'POTENTIAL_MATCH') {
      throw new BadRequestException({
        code: 'INVALID_MATCH_STATE',
        message: 'Only POTENTIAL matches can be confirmed or rejected.',
      });
    }

    if (match.status === 'CONFIRMED') {
      throw new ConflictException({
        code: 'MATCH_ALREADY_CONFIRMED',
        message: 'This match has already been confirmed.',
      });
    }

    if (match.status === 'REJECTED') {
      throw new ConflictException({
        code: 'MATCH_ALREADY_REJECTED',
        message: 'This match has already been rejected.',
      });
    }

    const now = new Date();
    match.status = 'REJECTED';
    match.rejectedBy = userId;
    match.rejectedAt = now;
    match.updatedAt = now;

    if (reason) {
      match.reasons = {
        ...(match.reasons as Record<string, unknown>),
        rejectionReason: reason,
      };
    }

    const txnIds = [match.transactionAId, match.transactionBId, match.transactionCId].filter(
      (id): id is string => typeof id === 'string' && id.length > 0,
    );

    // Recalculate transaction statuses for A, B, and C
    if (this.transactionsRepo) {
      for (const txnId of txnIds) {
        // Find other matches for this txn
        const otherMatches = this.matches.filter(
          (m) =>
            m.organizationId === orgId &&
            m.id !== matchId &&
            (m.transactionAId === txnId || m.transactionBId === txnId || m.transactionCId === txnId),
        );

        const hasConfirmed = otherMatches.some((m) => m.status === 'CONFIRMED');
        const hasPending = otherMatches.some((m) => m.status === 'PENDING');

        let nextStatus = 'UNMATCHED';
        if (hasConfirmed) {
          nextStatus = 'MATCHED';
        } else if (hasPending) {
          nextStatus = 'POTENTIAL_MATCH';
        }

        await this.transactionsRepo.updateStatuses(orgId, [txnId], nextStatus as any);
      }
    }

    const updated = await this.findMatchById(orgId, matchId);
    return updated!;
  }

  async findUnmatchedTransactions(
    orgId: string,
    run: ReconciliationRun,
    query: QueryUnmatchedDto,
  ): Promise<{ data: Transaction[]; total: number }> {
    const config = (run.config as Record<string, unknown>) || {};
    const unmatchedIds = (config.unmatchedTransactionIds as string[]) || [];

    if (!this.transactionsRepo) {
      return { data: [], total: 0 };
    }

    let allUnmatched: Transaction[] = [];

    if (unmatchedIds.length > 0) {
      for (const id of unmatchedIds) {
        const txn = await this.transactionsRepo.findById(orgId, id);
        if (txn) {
          allUnmatched.push(txn);
        }
      }
    } else {
      // Fallback: eligible in range not in matches
      const rawDateFrom = (config.dateFrom as string) || '1970-01-01';
      const rawDateTo = (config.dateTo as string) || '2099-12-31';
      const fromDate = new Date(
        rawDateFrom.includes('T') ? rawDateFrom : `${rawDateFrom}T00:00:00.000Z`,
      );
      const toDate = new Date(
        rawDateTo.includes('T') ? rawDateTo : `${rawDateTo}T23:59:59.999Z`,
      );

      const txnsA = await this.transactionsRepo.findEligibleForReconciliation(
        orgId,
        run.sourceAId,
        fromDate,
        toDate,
      );
      const txnsB = await this.transactionsRepo.findEligibleForReconciliation(
        orgId,
        run.sourceBId,
        fromDate,
        toDate,
      );
      let txnsC: Transaction[] = [];
      if (run.sourceCId) {
        txnsC = await this.transactionsRepo.findEligibleForReconciliation(
          orgId,
          run.sourceCId,
          fromDate,
          toDate,
        );
      }

      const matchedInRun = new Set(
        this.matches
          .filter((m) => m.runId === run.id)
          .flatMap((m) => [m.transactionAId, m.transactionBId, m.transactionCId])
          .filter(Boolean),
      );

      allUnmatched = [...txnsA, ...txnsB, ...txnsC].filter((t) => !matchedInRun.has(t.id));
    }

    const total = allUnmatched.length;
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;
    const data = allUnmatched.slice(offset, offset + limit);

    return { data, total };
  }

  clear(): void {
    this.runs = [];
    this.matches = [];
  }
}
