import { apiClient } from '../client';
import { Transaction, TransactionStatus, PaginatedResult } from '../types';
import { normalizePagination } from '../pagination';

export interface QueryTransactionsParams {
  sourceId?: string;
  importId?: string;
  dateFrom?: string;
  dateTo?: string;
  amount?: number; // Minor units
  status?: TransactionStatus;
  q?: string;
  page?: number;
  limit?: number;
  sortBy?: 'transactionDate' | 'createdAt' | 'amountMinor';
  sortOrder?: 'asc' | 'desc';
}

export const transactionsApi = {
  list: async (orgId: string, params?: QueryTransactionsParams): Promise<PaginatedResult<Transaction>> => {
    const raw = await apiClient.get<any>(`/orgs/${orgId}/transactions`, {
      params: params as any,
    });
    return normalizePagination<Transaction>(raw, params?.page || 1, Math.min(params?.limit || 25, 100));
  },

  getById: (orgId: string, id: string) =>
    apiClient.get<Transaction>(`/orgs/${orgId}/transactions/${id}`),
};
