import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  asc,
  count,
  desc,
  DuplicateCandidate,
  duplicateCandidates,
  eq,
  gte,
  ilike,
  lte,
  or,
  Transaction,
  transactions,
} from '@reconcilex/db';
import { SQL } from 'drizzle-orm';
import { DATABASE_CLIENT, DatabaseClient } from '../../../database/database.constants';
import { QueryTransactionsDto } from '../dto/transaction.dto';
import { ITransactionsRepository } from './transactions.repository.interface';

@Injectable()
export class DrizzleTransactionsRepository implements ITransactionsRepository {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: DatabaseClient,
  ) {}

  async findMany(
    organizationId: string,
    query: QueryTransactionsDto,
  ): Promise<{ data: Transaction[]; total: number }> {
    const conditions: (SQL | undefined)[] = [
      eq(transactions.organizationId, organizationId),
    ];

    if (query.dataSourceId) {
      conditions.push(eq(transactions.dataSourceId, query.dataSourceId));
    }

    if (query.status) {
      conditions.push(eq(transactions.status, query.status));
    }

    if (query.currency) {
      conditions.push(eq(transactions.currency, query.currency.toUpperCase()));
    }

    if (query.startDate) {
      conditions.push(gte(transactions.transactionDate, new Date(query.startDate)));
    }

    if (query.endDate) {
      conditions.push(lte(transactions.transactionDate, new Date(query.endDate)));
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

    const whereClause = and(...conditions);

    // Get total count
    const [countResult] = await this.db
      .select({ total: count() })
      .from(transactions)
      .where(whereClause);

    const total = Number(countResult?.total ?? 0);

    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const offset = (page - 1) * limit;

    const sortColumn =
      query.sortBy === 'createdAt'
        ? transactions.createdAt
        : query.sortBy === 'amountMinor'
          ? transactions.amountMinor
          : transactions.transactionDate;

    const orderFn = query.sortOrder === 'asc' ? asc : desc;

    const data = await this.db
      .select()
      .from(transactions)
      .where(whereClause)
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset(offset);

    return { data, total };
  }

  async findById(
    organizationId: string,
    id: string,
  ): Promise<Transaction | null> {
    const [record] = await this.db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.organizationId, organizationId),
          eq(transactions.id, id),
        ),
      );

    return record || null;
  }

  async findDuplicateCandidates(
    organizationId: string,
  ): Promise<DuplicateCandidate[]> {
    return this.db
      .select()
      .from(duplicateCandidates)
      .where(eq(duplicateCandidates.organizationId, organizationId))
      .orderBy(desc(duplicateCandidates.createdAt));
  }
}
