import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  PaginatedTransactionsResponse,
  QueryTransactionsDto,
  TransactionDetailDto,
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
    return this.transactionsRepo.findMany(organizationId, query);
  }

  async findById(organizationId: string, id: string): Promise<TransactionDetailDto> {
    const txn = await this.transactionsRepo.findById(organizationId, id);
    if (!txn) {
      throw new NotFoundException('Transaction not found');
    }
    return txn as TransactionDetailDto;
  }
}
