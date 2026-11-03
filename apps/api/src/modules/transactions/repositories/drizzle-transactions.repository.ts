import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  asc,
  count,
  DatabaseClient,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  NewTransaction,
  or,
  sql,
  Transaction,
  transactions,
} from '@reconcilex/db';
import { SQL } from 'drizzle-orm';
import { DATABASE_CLIENT } from '../../../database/database.constants';
import {
  PaginatedTransactionsResponse,
  QueryTransactionsDto,
  TransactionListItemDto,
} from '../dto/transaction.dto';
import { ITransactionsRepository } from './transactions.repository.interface';

interface CursorPayload {
  v: string | number;
  id: string;
}

@Injectable()
export class DrizzleTransactionsRepository implements ITransactionsRepository {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: DatabaseClient,
  ) {}

  private encodeCursor(v: string | number, id: string): string {
    return Buffer.from(JSON.stringify({ v, id })).toString('base64url');
  }

  private decodeCursor(cursor: string): CursorPayload | null {
    try {
      const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
      return JSON.parse(decoded) as CursorPayload;
    } catch {
      return null;
    }
  }

  async findMany(
    organizationId: string,
    query: QueryTransactionsDto,
  ): Promise<PaginatedTransactionsResponse> {
    const conditions: (SQL | undefined)[] = [eq(transactions.organizationId, organizationId)];

    const sourceId = query.sourceId || query.dataSourceId;
    if (sourceId) {
      conditions.push(eq(transactions.dataSourceId, sourceId));
    }

    if (query.importId) {
      conditions.push(eq(transactions.importId, query.importId));
    }

    if (query.status) {
      conditions.push(eq(transactions.status, query.status));
    }

    if (query.currency) {
      conditions.push(eq(transactions.currency, query.currency.toUpperCase()));
    }

    const dateFrom = query.dateFrom || query.startDate;
    if (dateFrom) {
      conditions.push(gte(transactions.transactionDate, new Date(dateFrom)));
    }

    const dateTo = query.dateTo || query.endDate;
    if (dateTo) {
      conditions.push(lte(transactions.transactionDate, new Date(dateTo)));
    }

    if (query.amount !== undefined) {
      conditions.push(eq(transactions.amountMinor, query.amount));
    }

    if (query.minAmount !== undefined) {
      conditions.push(gte(transactions.amountMinor, query.minAmount));
    }

    if (query.maxAmount !== undefined) {
      conditions.push(lte(transactions.amountMinor, query.maxAmount));
    }

    if (query.q && query.q.trim()) {
      const searchPattern = `%${query.q.trim()}%`;
      conditions.push(
        or(
          ilike(transactions.externalId, searchPattern),
          ilike(transactions.reference, searchPattern),
        ),
      );
    }

    const sortField = query.sortBy || 'transactionDate';
    const isAsc = query.sortOrder === 'asc';
    const sortColumn =
      sortField === 'createdAt'
        ? transactions.createdAt
        : sortField === 'amountMinor'
          ? transactions.amountMinor
          : transactions.transactionDate;

    // Handle cursor pagination condition if cursor is provided
    if (query.cursor) {
      const cursorData = this.decodeCursor(query.cursor);
      if (cursorData) {
        const cursorValue =
          sortField === 'amountMinor' ? Number(cursorData.v) : new Date(cursorData.v);

        if (isAsc) {
          conditions.push(
            or(
              gte(sortColumn, cursorValue),
              and(eq(sortColumn, cursorValue), gte(transactions.id, cursorData.id)),
            ),
          );
        } else {
          conditions.push(
            or(
              lte(sortColumn, cursorValue),
              and(eq(sortColumn, cursorValue), lte(transactions.id, cursorData.id)),
            ),
          );
        }
      }
    }

    const whereClause = and(...conditions);

    // Get total count
    const [countResult] = await this.db
      .select({ total: count() })
      .from(transactions)
      .where(whereClause);

    const total = Number(countResult?.total ?? 0);

    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const page = query.page && query.page > 0 ? query.page : 1;
    const offset = query.cursor ? 0 : (page - 1) * limit;

    const orderFn = isAsc ? asc : desc;

    // Fetch limit + 1 to detect hasMore and nextCursor
    const rows = await this.db
      .select({
        id: transactions.id,
        organizationId: transactions.organizationId,
        dataSourceId: transactions.dataSourceId,
        importId: transactions.importId,
        externalId: transactions.externalId,
        amountMinor: transactions.amountMinor,
        currency: transactions.currency,
        transactionDate: transactions.transactionDate,
        reference: transactions.reference,
        externalTxnId: transactions.externalTxnId,
        merchantOrOrderId: transactions.merchantOrOrderId,
        txnType: transactions.txnType,
        status: transactions.status,
        createdAt: transactions.createdAt,
        updatedAt: transactions.updatedAt,
      })
      .from(transactions)
      .where(whereClause)
      .orderBy(orderFn(sortColumn), orderFn(transactions.id))
      .limit(limit + 1)
      .offset(offset);

    const hasMore = rows.length > limit;
    const data: TransactionListItemDto[] = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (data.length > 0 && hasMore) {
      const lastItem = data[data.length - 1];
      const cursorVal =
        sortField === 'createdAt'
          ? lastItem.createdAt.toISOString()
          : sortField === 'amountMinor'
            ? lastItem.amountMinor
            : lastItem.transactionDate.toISOString();
      nextCursor = this.encodeCursor(cursorVal, lastItem.id);
    }

    const totalPages = Math.ceil(total / limit) || (total === 0 ? 0 : 1);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
      nextCursor,
      hasMore,
    };
  }

  async findById(organizationId: string, id: string): Promise<Transaction | null> {
    const [record] = await this.db
      .select()
      .from(transactions)
      .where(and(eq(transactions.organizationId, organizationId), eq(transactions.id, id)));

    return record || null;
  }

  async createBatch(organizationId: string, newTxns: NewTransaction[]): Promise<Transaction[]> {
    if (newTxns.length === 0) return [];
    return this.db.insert(transactions).values(newTxns).returning();
  }

  async findByExternalIds(
    organizationId: string,
    dataSourceId: string,
    externalIds: string[],
  ): Promise<Transaction[]> {
    if (externalIds.length === 0) return [];
    return this.db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.organizationId, organizationId),
          eq(transactions.dataSourceId, dataSourceId),
          inArray(transactions.externalId, externalIds),
        ),
      );
  }

  async findEligibleForReconciliation(
    organizationId: string,
    dataSourceId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<Transaction[]> {
    return this.db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.organizationId, organizationId),
          eq(transactions.dataSourceId, dataSourceId),
          gte(transactions.transactionDate, dateFrom),
          lte(transactions.transactionDate, dateTo),
          sql`${transactions.status} != 'MATCHED'`,
        ),
      );
  }

  async updateStatuses(
    organizationId: string,
    transactionIds: string[],
    status: string,
  ): Promise<void> {
    if (transactionIds.length === 0) return;
    await this.db
      .update(transactions)
      .set({ status, updatedAt: new Date() })
      .where(
        and(
          eq(transactions.organizationId, organizationId),
          inArray(transactions.id, transactionIds),
        ),
      );
  }
}
