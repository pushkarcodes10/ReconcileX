import { Injectable } from '@nestjs/common';
import { Transaction } from '@reconcilex/db';
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
export class InMemoryTransactionsRepository implements ITransactionsRepository {
  public transactions: Transaction[] = [];

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
    let filtered = this.transactions.filter((t) => t.organizationId === organizationId);

    const sourceId = query.sourceId || query.dataSourceId;
    if (sourceId) {
      filtered = filtered.filter((t) => t.dataSourceId === sourceId);
    }

    if (query.status) {
      filtered = filtered.filter((t) => t.status === query.status);
    }

    if (query.currency) {
      filtered = filtered.filter((t) => t.currency.toUpperCase() === query.currency!.toUpperCase());
    }

    const dateFrom = query.dateFrom || query.startDate;
    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      filtered = filtered.filter((t) => t.transactionDate.getTime() >= from);
    }

    const dateTo = query.dateTo || query.endDate;
    if (dateTo) {
      const to = new Date(dateTo).getTime();
      filtered = filtered.filter((t) => t.transactionDate.getTime() <= to);
    }

    if (query.amount !== undefined) {
      filtered = filtered.filter((t) => t.amountMinor === query.amount);
    }

    if (query.minAmount !== undefined) {
      filtered = filtered.filter((t) => t.amountMinor >= query.minAmount!);
    }

    if (query.maxAmount !== undefined) {
      filtered = filtered.filter((t) => t.amountMinor <= query.maxAmount!);
    }

    if (query.q && query.q.trim()) {
      const pattern = query.q.trim().toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.externalId.toLowerCase().includes(pattern) ||
          (t.reference && t.reference.toLowerCase().includes(pattern)),
      );
    }

    const sortField = query.sortBy || 'transactionDate';
    const isAsc = query.sortOrder === 'asc';

    filtered.sort((a, b) => {
      let valA: number;
      let valB: number;

      if (sortField === 'createdAt') {
        valA = a.createdAt.getTime();
        valB = b.createdAt.getTime();
      } else if (sortField === 'amountMinor') {
        valA = a.amountMinor;
        valB = b.amountMinor;
      } else {
        valA = a.transactionDate.getTime();
        valB = b.transactionDate.getTime();
      }

      if (valA === valB) {
        return isAsc ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id);
      }
      return isAsc ? valA - valB : valB - valA;
    });

    const total = filtered.length;

    if (query.cursor) {
      const cursorData = this.decodeCursor(query.cursor);
      if (cursorData) {
        const cursorIdx = filtered.findIndex((t) => t.id === cursorData.id);
        if (cursorIdx !== -1) {
          filtered = filtered.slice(cursorIdx);
        }
      }
    }

    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const page = query.page && query.page > 0 ? query.page : 1;
    const offset = query.cursor ? 0 : (page - 1) * limit;

    const sliced = filtered.slice(offset, offset + limit + 1);
    const hasMore = sliced.length > limit;
    const resultRows = hasMore ? sliced.slice(0, limit) : sliced;

    const data: TransactionListItemDto[] = resultRows.map((t) => ({
      id: t.id,
      organizationId: t.organizationId,
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
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));

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
    const txn = this.transactions.find((t) => t.organizationId === organizationId && t.id === id);
    return txn ? { ...txn } : null;
  }
}
