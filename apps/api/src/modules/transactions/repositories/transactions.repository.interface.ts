import { NewTransaction, Transaction } from '@reconcilex/db';
import { PaginatedTransactionsResponse, QueryTransactionsDto } from '../dto/transaction.dto';

export const TRANSACTIONS_REPOSITORY = 'TRANSACTIONS_REPOSITORY';

export interface ITransactionsRepository {
  findMany(
    organizationId: string,
    query: QueryTransactionsDto,
  ): Promise<PaginatedTransactionsResponse>;
  findById(organizationId: string, id: string): Promise<Transaction | null>;
  createBatch(organizationId: string, transactions: NewTransaction[]): Promise<Transaction[]>;
  findByExternalIds(
    organizationId: string,
    dataSourceId: string,
    externalIds: string[],
  ): Promise<Transaction[]>;
}
