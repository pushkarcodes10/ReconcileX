import { DuplicateCandidate, Transaction } from '@reconcilex/db';
import { QueryTransactionsDto } from '../dto/transaction.dto';

export const TRANSACTIONS_REPOSITORY = 'TRANSACTIONS_REPOSITORY';

export interface ITransactionsRepository {
  findMany(
    organizationId: string,
    query: QueryTransactionsDto,
  ): Promise<{ data: Transaction[]; total: number }>;
  findById(organizationId: string, id: string): Promise<Transaction | null>;
  findDuplicateCandidates(organizationId: string): Promise<DuplicateCandidate[]>;
}
