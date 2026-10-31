import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DuplicateCandidate, Transaction } from '@reconcilex/db';
import {
  PaginatedTransactionsResponse,
  QueryTransactionsDto,
} from './dto/transaction.dto';
import {
  ITransactionsRepository,
  TRANSACTIONS_REPOSITORY,
} from './repositories/transactions.repository.interface';

@Injectable()
export class TransactionsService {
  constructor(
    @Inject(TRANSACTIONS_REPOSITORY)
    private readonly transactionsRepo: ITransactionsRepository,
  ) {}

  async findMany(
    organizationId: string,
    query: QueryTransactionsDto,
  ): Promise<PaginatedTransactionsResponse> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;

    const { data, total } = await this.transactionsRepo.findMany(
      organizationId,
      query,
    );

    const totalPages = Math.ceil(total / limit) || (total === 0 ? 0 : 1);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async findById(organizationId: string, id: string): Promise<Transaction> {
    const txn = await this.transactionsRepo.findById(organizationId, id);
    if (!txn) {
      throw new NotFoundException('Transaction not found');
    }
    return txn;
  }

  async findDuplicateCandidates(
    organizationId: string,
  ): Promise<DuplicateCandidate[]> {
    return this.transactionsRepo.findDuplicateCandidates(organizationId);
  }
}
