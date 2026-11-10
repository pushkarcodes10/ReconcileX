import { apiClient } from '../client';
import {
  ReconciliationRun,
  ReconciliationRunStatus,
  MatchRecord,
  Transaction,
  MatchClassification,
  MatchStatus,
  PaginatedResult,
} from '../types';
import { normalizePagination } from '../pagination';
import { generateIdempotencyKey } from '../../shared/lib/idempotency';

export interface CreateReconciliationRunDto {
  reconciliationType?: 'TWO_SOURCE' | 'THREE_SOURCE';
  sourceA: string;
  sourceB: string;
  sourceC?: string;
  dateFrom: string;
  dateTo: string;
  config?: {
    dateWindowDays?: number;
    dateToleranceDays?: number;
    potentialThreshold?: number;
    exactThreshold?: number;
  };
}

export interface CreateRunResponse {
  jobId: string;
  runId: string;
  status: ReconciliationRunStatus;
  run: ReconciliationRun;
}

export interface QueryRunsParams {
  status?: ReconciliationRunStatus;
  sourceId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface QueryMatchesParams {
  classification?: MatchClassification;
  status?: MatchStatus;
  page?: number;
  limit?: number;
}

export const reconciliationApi = {
  createRun: (orgId: string, dto: CreateReconciliationRunDto, idempotencyKey?: string) => {
    const key = idempotencyKey || generateIdempotencyKey();
    return apiClient.post<CreateRunResponse>(
      `/orgs/${orgId}/reconciliation-runs`,
      dto,
      {
        headers: {
          'Idempotency-Key': key,
        },
      }
    );
  },

  listRuns: async (orgId: string, params?: QueryRunsParams): Promise<PaginatedResult<ReconciliationRun>> => {
    const raw = await apiClient.get<any>(`/orgs/${orgId}/reconciliation-runs`, {
      params: params as any,
    });
    return normalizePagination<ReconciliationRun>(raw, params?.page || 1, params?.limit || 20);
  },

  getRunById: (orgId: string, id: string) =>
    apiClient.get<ReconciliationRun>(`/orgs/${orgId}/reconciliation-runs/${id}`),

  getMatches: async (orgId: string, runId: string, params?: QueryMatchesParams): Promise<PaginatedResult<MatchRecord>> => {
    const raw = await apiClient.get<any>(`/orgs/${orgId}/reconciliation-runs/${runId}/matches`, {
      params: params as any,
    });
    return normalizePagination<MatchRecord>(raw, params?.page || 1, params?.limit || 20);
  },

  getUnmatched: async (orgId: string, runId: string, params?: { page?: number; limit?: number }): Promise<PaginatedResult<Transaction>> => {
    const raw = await apiClient.get<any>(`/orgs/${orgId}/reconciliation-runs/${runId}/unmatched`, {
      params: params as any,
    });
    return normalizePagination<Transaction>(raw, params?.page || 1, params?.limit || 20);
  },

  confirmMatch: (orgId: string, matchId: string) =>
    apiClient.post<{ success: boolean; match: MatchRecord }>(`/orgs/${orgId}/matches/${matchId}/confirm`),

  rejectMatch: (orgId: string, matchId: string, reason?: string) =>
    apiClient.post<{ success: boolean; match: MatchRecord }>(`/orgs/${orgId}/matches/${matchId}/reject`, {
      reason,
    }),
};
