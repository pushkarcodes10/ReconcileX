import { Injectable } from '@nestjs/common';
import { DuplicateCandidate, Transaction } from '@reconcilex/db';
import { QueryTransactionsDto } from '../dto/transaction.dto';
import { ITransactionsRepository } from './transactions.repository.interface';

@Injectable()
export class InMemoryTransactionsRepository implements ITransactionsRepository {
  public transactions: Transaction[] = [];
  public duplicateCandidates: DuplicateCandidate[] = [];

  async findMany(
    organizationId: string,
    query: QueryTransactionsDto,
  ): Promise<{ data: Transaction[]; total: number }> {
    let list = this.transactions.filter(
      (t) => t.organizationId === organizationId,
    );

    if (query.dataSourceId) {
      list = list.filter((t) => t.dataSourceId === query.dataSourceId);
    }

    if (query.status) {
      list = list.filter((t) => t.status === query.status);
    }

    if (query.currency) {
      list = list.filter(
        (t) => t.currency.toUpperCase() === query.currency!.toUpperCase(),
      );
    }

    if (query.startDate) {
      const start = new Date(query.startDate).getTime();
      list = list.filter((t) => t.transactionDate.getTime() >= start);
    }

    if (query.endDate) {
      const end = new Date(query.endDate).getTime();
      list = list.filter((t) => t.transactionDate.getTime() <= end);
    }

    if (query.minAmount !== undefined) {
      list = list.filter((t) => t.amountMinor >= query.minAmount!);
    }

    if (query.maxAmount !== undefined) {
      list = list.filter((t) => t.amountMinor <= query.maxAmount!);
    }

    if (query.q && query.q.trim()) {
      const qLower = query.q.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.externalId.toLowerCase().includes(qLower) ||
          (t.reference && t.reference.toLowerCase().includes(qLower)),
      );
    }

    const total = list.length;

    // Sorting
    const sortField = query.sortBy || 'transactionDate';
    const isAsc = query.sortOrder === 'asc';

    list.sort((a, b) => {
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

      return isAsc ? valA - valB : valB - valA;
    });

    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const offset = (page - 1) * limit;

    const data = list.slice(offset, offset + limit).map((t) => ({ ...t }));
    return { data, total };
  }

  async findById(
    organizationId: string,
    id: string,
  ): Promise<Transaction | null> {
    const txn = this.transactions.find(
      (t) => t.organizationId === organizationId && t.id === id,
    );
    return txn ? { ...txn } : null;
  }

  async findDuplicateCandidates(
    organizationId: string,
  ): Promise<DuplicateCandidate[]> {
    return this.duplicateCandidates
      .filter((d) => d.organizationId === organizationId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((d) => ({ ...d }));
  }
}
