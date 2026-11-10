import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  count,
  DatabaseClient,
  DataSource,
  dataSources,
  desc,
  eq,
  gte,
  inArray,
  lte,
  Match,
  matches,
  NewMatch,
  NewReconciliationRun,
  or,
  ReconciliationRun,
  reconciliationRuns,
  sql,
  Transaction,
  transactions,
} from '@reconcilex/db';
import { SQL } from 'drizzle-orm';
import { DATABASE_CLIENT } from '../../../database/database.constants';
import { QueryMatchesDto } from '../dto/query-matches.dto';
import { QueryReconciliationRunsDto } from '../dto/query-reconciliation-runs.dto';
import { QueryUnmatchedDto } from '../dto/query-unmatched.dto';
import {
  IReconciliationRepository,
  MatchWithTransactions,
  ReconciliationRunWithSources,
} from './reconciliation.repository.interface';

@Injectable()
export class DrizzleReconciliationRepository implements IReconciliationRepository {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: DatabaseClient,
  ) {}

  async createRun(newRun: NewReconciliationRun): Promise<ReconciliationRun> {
    const [created] = await this.db.insert(reconciliationRuns).values(newRun).returning();
    return created;
  }

  async updateRun(id: string, updates: Partial<ReconciliationRun>): Promise<ReconciliationRun> {
    const [updated] = await this.db
      .update(reconciliationRuns)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(reconciliationRuns.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException({
        code: 'RUN_NOT_FOUND',
        message: 'Reconciliation run not found',
      });
    }

    return updated;
  }

  async findRunById(orgId: string, runId: string): Promise<ReconciliationRun | null> {
    const [record] = await this.db
      .select()
      .from(reconciliationRuns)
      .where(
        and(eq(reconciliationRuns.organizationId, orgId), eq(reconciliationRuns.id, runId)),
      );

    return record || null;
  }

  async findRunDetailById(
    orgId: string,
    runId: string,
  ): Promise<ReconciliationRunWithSources | null> {
    const run = await this.findRunById(orgId, runId);
    if (!run) return null;

    const [sourceA] = await this.db
      .select()
      .from(dataSources)
      .where(and(eq(dataSources.organizationId, orgId), eq(dataSources.id, run.sourceAId)));

    const [sourceB] = await this.db
      .select()
      .from(dataSources)
      .where(and(eq(dataSources.organizationId, orgId), eq(dataSources.id, run.sourceBId)));

    let sourceC: DataSource | null = null;
    if (run.sourceCId) {
      const [sc] = await this.db
        .select()
        .from(dataSources)
        .where(and(eq(dataSources.organizationId, orgId), eq(dataSources.id, run.sourceCId)));
      sourceC = sc || null;
    }

    let sourceD: DataSource | null = null;
    if (run.sourceDId) {
      const [sd] = await this.db
        .select()
        .from(dataSources)
        .where(and(eq(dataSources.organizationId, orgId), eq(dataSources.id, run.sourceDId)));
      sourceD = sd || null;
    }

    return {
      ...run,
      sourceA: sourceA || {
        id: run.sourceAId,
        organizationId: orgId,
        name: `Source A`,
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
      },
      sourceB: sourceB || {
        id: run.sourceBId,
        organizationId: orgId,
        name: `Source B`,
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
      },
      sourceC: sourceC || (run.sourceCId ? {
        id: run.sourceCId,
        organizationId: orgId,
        name: `Source C`,
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
      } : null),
      sourceD: sourceD || (run.sourceDId ? {
        id: run.sourceDId,
        organizationId: orgId,
        name: `Source D`,
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
      } : null),
    };
  }

  async findRunByIdempotencyKey(orgId: string, key: string): Promise<ReconciliationRun | null> {
    const [record] = await this.db
      .select()
      .from(reconciliationRuns)
      .where(
        and(
          eq(reconciliationRuns.organizationId, orgId),
          eq(reconciliationRuns.idempotencyKey, key),
        ),
      );

    return record || null;
  }

  async findActiveRunForSources(
    orgId: string,
    sourceAId: string,
    sourceBId: string,
    sourceCId?: string,
    sourceDId?: string,
  ): Promise<ReconciliationRun | null> {
    const activeRuns = await this.db
      .select()
      .from(reconciliationRuns)
      .where(
        and(
          eq(reconciliationRuns.organizationId, orgId),
          or(
            eq(reconciliationRuns.status, 'PENDING'),
            eq(reconciliationRuns.status, 'PROCESSING'),
          ),
        ),
      );

    const targetSources = new Set([
      sourceAId,
      sourceBId,
      ...(sourceCId ? [sourceCId] : []),
      ...(sourceDId ? [sourceDId] : []),
    ]);

    for (const r of activeRuns) {
      const runSources = new Set([
        r.sourceAId,
        r.sourceBId,
        ...(r.sourceCId ? [r.sourceCId] : []),
        ...(r.sourceDId ? [r.sourceDId] : []),
      ]);
      // If same exact sources participating in active run
      if (runSources.size === targetSources.size && [...targetSources].every((s) => runSources.has(s))) {
        return r;
      }
    }

    return null;
  }

  async getNextDisplayId(orgId: string, dateStr: string): Promise<string> {
    const prefix = `RUN-${dateStr}-`;
    const records = await this.db
      .select({ displayId: reconciliationRuns.displayId })
      .from(reconciliationRuns)
      .where(
        and(
          eq(reconciliationRuns.organizationId, orgId),
          sql`${reconciliationRuns.displayId} LIKE ${`${prefix}%`}`,
        ),
      );

    let maxNum = 0;
    for (const r of records) {
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
    const conditions: (SQL | undefined)[] = [eq(reconciliationRuns.organizationId, orgId)];

    if (query.status) {
      conditions.push(eq(reconciliationRuns.status, query.status));
    }

    if (query.sourceId) {
      conditions.push(
        or(
          eq(reconciliationRuns.sourceAId, query.sourceId),
          eq(reconciliationRuns.sourceBId, query.sourceId),
        ),
      );
    }

    if (query.dateFrom) {
      conditions.push(gte(reconciliationRuns.createdAt, new Date(query.dateFrom)));
    }

    if (query.dateTo) {
      const toStr = query.dateTo.includes('T') ? query.dateTo : `${query.dateTo}T23:59:59.999Z`;
      conditions.push(lte(reconciliationRuns.createdAt, new Date(toStr)));
    }

    const whereClause = and(...conditions);

    const [countResult] = await this.db
      .select({ total: count() })
      .from(reconciliationRuns)
      .where(whereClause);

    const total = Number(countResult?.total || 0);

    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    const sortOrder = query.sortOrder === 'asc' ? asc : desc;
    const orderExpr =
      query.sortBy === 'startedAt'
        ? sortOrder(reconciliationRuns.startedAt)
        : sortOrder(reconciliationRuns.createdAt);

    const data = await this.db
      .select()
      .from(reconciliationRuns)
      .where(whereClause)
      .orderBy(orderExpr)
      .limit(limit)
      .offset(offset);

    return { data, total };
  }

  async createMatches(newMatches: NewMatch[]): Promise<Match[]> {
    if (newMatches.length === 0) return [];
    return this.db.insert(matches).values(newMatches).returning();
  }

  async findMatches(
    orgId: string,
    runId: string,
    query: QueryMatchesDto,
  ): Promise<{ data: MatchWithTransactions[]; total: number }> {
    const conditions: (SQL | undefined)[] = [
      eq(matches.organizationId, orgId),
      eq(matches.runId, runId),
    ];

    if (query.classification) {
      conditions.push(eq(matches.classification, query.classification));
    }

    if (query.status) {
      conditions.push(eq(matches.status, query.status));
    }

    const whereClause = and(...conditions);

    const [countResult] = await this.db
      .select({ total: count() })
      .from(matches)
      .where(whereClause);

    const total = Number(countResult?.total || 0);

    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    const pageMatches = await this.db
      .select()
      .from(matches)
      .where(whereClause)
      .orderBy(desc(matches.createdAt))
      .limit(limit)
      .offset(offset);

    const withTxns: MatchWithTransactions[] = [];

    for (const m of pageMatches) {
      let txnA: Transaction | null = null;
      if (m.transactionAId) {
        const [ta] = await this.db
          .select()
          .from(transactions)
          .where(and(eq(transactions.organizationId, orgId), eq(transactions.id, m.transactionAId)));
        txnA = ta || null;
      }

      let txnB: Transaction | null = null;
      if (m.transactionBId) {
        const [tb] = await this.db
          .select()
          .from(transactions)
          .where(and(eq(transactions.organizationId, orgId), eq(transactions.id, m.transactionBId)));
        txnB = tb || null;
      }

      let txnC: Transaction | null = null;
      if (m.transactionCId) {
        const [tc] = await this.db
          .select()
          .from(transactions)
          .where(and(eq(transactions.organizationId, orgId), eq(transactions.id, m.transactionCId)));
        txnC = tc || null;
      }

      let txnD: Transaction | null = null;
      if (m.transactionDId) {
        const [td] = await this.db
          .select()
          .from(transactions)
          .where(and(eq(transactions.organizationId, orgId), eq(transactions.id, m.transactionDId)));
        txnD = td || null;
      }

      withTxns.push({
        ...m,
        transactionA: txnA,
        transactionB: txnB,
        transactionC: txnC,
        transactionD: txnD,
      });
    }

    return { data: withTxns, total };
  }

  async findMatchById(orgId: string, matchId: string): Promise<MatchWithTransactions | null> {
    const [record] = await this.db
      .select()
      .from(matches)
      .where(and(eq(matches.organizationId, orgId), eq(matches.id, matchId)));

    if (!record) return null;

    let txnA: Transaction | null = null;
    if (record.transactionAId) {
      const [ta] = await this.db
        .select()
        .from(transactions)
        .where(
          and(eq(transactions.organizationId, orgId), eq(transactions.id, record.transactionAId)),
        );
      txnA = ta || null;
    }

    let txnB: Transaction | null = null;
    if (record.transactionBId) {
      const [tb] = await this.db
        .select()
        .from(transactions)
        .where(
          and(eq(transactions.organizationId, orgId), eq(transactions.id, record.transactionBId)),
        );
      txnB = tb || null;
    }

    let txnC: Transaction | null = null;
    if (record.transactionCId) {
      const [tc] = await this.db
        .select()
        .from(transactions)
        .where(
          and(eq(transactions.organizationId, orgId), eq(transactions.id, record.transactionCId)),
        );
      txnC = tc || null;
    }

    let txnD: Transaction | null = null;
    if (record.transactionDId) {
      const [td] = await this.db
        .select()
        .from(transactions)
        .where(
          and(eq(transactions.organizationId, orgId), eq(transactions.id, record.transactionDId)),
        );
      txnD = td || null;
    }

    return {
      ...record,
      transactionA: txnA,
      transactionB: txnB,
      transactionC: txnC,
      transactionD: txnD,
    };
  }

  async confirmMatch(
    orgId: string,
    matchId: string,
    userId: string,
  ): Promise<MatchWithTransactions> {
    return this.db.transaction(async (tx) => {
      // 1. Lock and fetch match
      const [matchRecord] = await tx
        .select()
        .from(matches)
        .where(and(eq(matches.organizationId, orgId), eq(matches.id, matchId)))
        .for('update');

      if (!matchRecord) {
        throw new NotFoundException({
          code: 'MATCH_NOT_FOUND',
          message: 'Match not found',
        });
      }

      if (matchRecord.classification !== 'POTENTIAL' && matchRecord.classification !== 'POTENTIAL_MATCH') {
        throw new BadRequestException({
          code: 'INVALID_MATCH_STATE',
          message: 'Only POTENTIAL matches can be confirmed or rejected.',
        });
      }

      if (matchRecord.status === 'CONFIRMED') {
        throw new ConflictException({
          code: 'MATCH_ALREADY_CONFIRMED',
          message: 'This match has already been confirmed.',
        });
      }

      if (matchRecord.status === 'REJECTED') {
        throw new ConflictException({
          code: 'MATCH_ALREADY_REJECTED',
          message: 'This match has already been rejected.',
        });
      }

      // 2. Lock and check participating transactions
      const txnIds = [
        matchRecord.transactionAId,
        matchRecord.transactionBId,
        matchRecord.transactionCId,
        matchRecord.transactionDId,
      ].filter((id): id is string => typeof id === 'string' && id.length > 0);

      const lockedTxns = await tx
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.organizationId, orgId),
            inArray(transactions.id, txnIds),
          ),
        )
        .for('update');

      if (lockedTxns.some((t) => t.status === 'MATCHED')) {
        throw new ConflictException({
          code: 'TRANSACTION_ALREADY_MATCHED',
          message: 'One or more transactions in this match have already been matched.',
        });
      }

      const now = new Date();

      // 3. Update match
      const [updatedMatch] = await tx
        .update(matches)
        .set({
          status: 'CONFIRMED',
          confirmedBy: userId,
          confirmedAt: now,
          updatedAt: now,
        })
        .where(eq(matches.id, matchId))
        .returning();

      // 4. Update transactions
      await tx
        .update(transactions)
        .set({ status: 'MATCHED', updatedAt: now })
        .where(
          and(
            eq(transactions.organizationId, orgId),
            inArray(transactions.id, txnIds),
          ),
        );

      const updatedTxns = await tx
        .select()
        .from(transactions)
        .where(inArray(transactions.id, txnIds));

      return {
        ...updatedMatch,
        transactionA: updatedTxns.find((t) => t.id === matchRecord.transactionAId) || null,
        transactionB: updatedTxns.find((t) => t.id === matchRecord.transactionBId) || null,
        transactionC: updatedTxns.find((t) => t.id === matchRecord.transactionCId) || null,
        transactionD: updatedTxns.find((t) => t.id === matchRecord.transactionDId) || null,
      };
    });
  }

  async rejectMatch(
    orgId: string,
    matchId: string,
    userId: string,
    reason?: string,
  ): Promise<MatchWithTransactions> {
    return this.db.transaction(async (tx) => {
      // 1. Lock and fetch match
      const [matchRecord] = await tx
        .select()
        .from(matches)
        .where(and(eq(matches.organizationId, orgId), eq(matches.id, matchId)))
        .for('update');

      if (!matchRecord) {
        throw new NotFoundException({
          code: 'MATCH_NOT_FOUND',
          message: 'Match not found',
        });
      }

      if (matchRecord.classification !== 'POTENTIAL' && matchRecord.classification !== 'POTENTIAL_MATCH') {
        throw new BadRequestException({
          code: 'INVALID_MATCH_STATE',
          message: 'Only POTENTIAL matches can be confirmed or rejected.',
        });
      }

      if (matchRecord.status === 'CONFIRMED') {
        throw new ConflictException({
          code: 'MATCH_ALREADY_CONFIRMED',
          message: 'This match has already been confirmed.',
        });
      }

      if (matchRecord.status === 'REJECTED') {
        throw new ConflictException({
          code: 'MATCH_ALREADY_REJECTED',
          message: 'This match has already been rejected.',
        });
      }

      const now = new Date();

      const updatedReasons = reason
        ? {
            ...(matchRecord.reasons as Record<string, unknown>),
            rejectionReason: reason,
          }
        : matchRecord.reasons;

      // 2. Update match
      const [updatedMatch] = await tx
        .update(matches)
        .set({
          status: 'REJECTED',
          rejectedBy: userId,
          rejectedAt: now,
          reasons: updatedReasons,
          updatedAt: now,
        })
        .where(eq(matches.id, matchId))
        .returning();

      // 3. Recalculate transaction statuses for participating transactions
      const txnIds = [
        matchRecord.transactionAId,
        matchRecord.transactionBId,
        matchRecord.transactionCId,
        matchRecord.transactionDId,
      ].filter((id): id is string => typeof id === 'string' && id.length > 0);

      for (const txnId of txnIds) {
        const otherMatches = await tx
          .select({ status: matches.status })
          .from(matches)
          .where(
            and(
              eq(matches.organizationId, orgId),
              sql`${matches.id} != ${matchId}`,
              or(
                eq(matches.transactionAId, txnId),
                eq(matches.transactionBId, txnId),
                eq(matches.transactionCId, txnId),
                eq(matches.transactionDId, txnId),
              ),
            ),
          );

        const hasConfirmed = otherMatches.some((m) => m.status === 'CONFIRMED');
        const hasPending = otherMatches.some((m) => m.status === 'PENDING');

        let nextStatus = 'UNMATCHED';
        if (hasConfirmed) {
          nextStatus = 'MATCHED';
        } else if (hasPending) {
          nextStatus = 'POTENTIAL_MATCH';
        }

        await tx
          .update(transactions)
          .set({ status: nextStatus, updatedAt: now })
          .where(and(eq(transactions.organizationId, orgId), eq(transactions.id, txnId)));
      }

      const updatedTxns = await tx
        .select()
        .from(transactions)
        .where(inArray(transactions.id, txnIds));

      return {
        ...updatedMatch,
        transactionA: updatedTxns.find((t) => t.id === matchRecord.transactionAId) || null,
        transactionB: updatedTxns.find((t) => t.id === matchRecord.transactionBId) || null,
        transactionC: updatedTxns.find((t) => t.id === matchRecord.transactionCId) || null,
        transactionD: updatedTxns.find((t) => t.id === matchRecord.transactionDId) || null,
      };
    });
  }

  async findUnmatchedTransactions(
    orgId: string,
    run: ReconciliationRun,
    query: QueryUnmatchedDto,
  ): Promise<{ data: Transaction[]; total: number }> {
    const config = (run.config as Record<string, unknown>) || {};
    const unmatchedIds = (config.unmatchedTransactionIds as string[]) || [];

    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    if (unmatchedIds.length > 0) {
      const [countResult] = await this.db
        .select({ total: count() })
        .from(transactions)
        .where(
          and(
            eq(transactions.organizationId, orgId),
            inArray(transactions.id, unmatchedIds),
          ),
        );

      const total = Number(countResult?.total || 0);

      const data = await this.db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.organizationId, orgId),
            inArray(transactions.id, unmatchedIds),
          ),
        )
        .limit(limit)
        .offset(offset);

      return { data, total };
    }

    // Fallback: eligible txns in date range not present in matches for this run
    const rawDateFrom = (config.dateFrom as string) || '1970-01-01';
    const rawDateTo = (config.dateTo as string) || '2099-12-31';
    const fromDate = new Date(
      rawDateFrom.includes('T') ? rawDateFrom : `${rawDateFrom}T00:00:00.000Z`,
    );
    const toDate = new Date(
      rawDateTo.includes('T') ? rawDateTo : `${rawDateTo}T23:59:59.999Z`,
    );

    const matchTxns = await this.db
      .select({
        txnA: matches.transactionAId,
        txnB: matches.transactionBId,
        txnC: matches.transactionCId,
        txnD: matches.transactionDId,
      })
      .from(matches)
      .where(eq(matches.runId, run.id));

    const matchedIds = new Set<string>();
    for (const m of matchTxns) {
      if (m.txnA) matchedIds.add(m.txnA);
      if (m.txnB) matchedIds.add(m.txnB);
      if (m.txnC) matchedIds.add(m.txnC);
      if (m.txnD) matchedIds.add(m.txnD);
    }

    const sourceConditions = [
      eq(transactions.dataSourceId, run.sourceAId),
      eq(transactions.dataSourceId, run.sourceBId),
    ];
    if (run.sourceCId) {
      sourceConditions.push(eq(transactions.dataSourceId, run.sourceCId));
    }
    if (run.sourceDId) {
      sourceConditions.push(eq(transactions.dataSourceId, run.sourceDId));
    }

    const conditions: SQL[] = [
      eq(transactions.organizationId, orgId),
      or(...sourceConditions)!,
      gte(transactions.transactionDate, fromDate),
      lte(transactions.transactionDate, toDate),
    ];

    if (matchedIds.size > 0) {
      conditions.push(sql`${transactions.id} NOT IN (${sql.join(Array.from(matchedIds).map((id) => sql`${id}`), sql`, `)})`);
    }

    const whereClause = and(...conditions);

    const [countResult] = await this.db
      .select({ total: count() })
      .from(transactions)
      .where(whereClause);

    const total = Number(countResult?.total || 0);

    const data = await this.db
      .select()
      .from(transactions)
      .where(whereClause)
      .limit(limit)
      .offset(offset);

    return { data, total };
  }
}
