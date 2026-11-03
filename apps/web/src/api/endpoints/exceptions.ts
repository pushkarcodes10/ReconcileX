import { apiClient } from '../client';
import {
  ExceptionRecord,
  ExceptionComment,
  ExceptionStatus,
  ExceptionAction,
  ResolutionAction,
  PaginatedResult,
} from '../types';
import { normalizePagination } from '../pagination';

export interface QueryExceptionsParams {
  status?: ExceptionStatus;
  assigneeId?: string;
  runId?: string;
  createdFrom?: string;
  createdTo?: string;
  q?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface TransitionExceptionDto {
  action: ExceptionAction;
  resolutionReason?: string;
  resolutionAction?: ResolutionAction;
}

export const exceptionsApi = {
  list: async (orgId: string, params?: QueryExceptionsParams): Promise<PaginatedResult<ExceptionRecord>> => {
    const raw = await apiClient.get<any>(`/orgs/${orgId}/exceptions`, {
      params: params as any,
    });
    return normalizePagination<ExceptionRecord>(raw, params?.page || 1, params?.limit || 20);
  },

  getById: (orgId: string, id: string) =>
    apiClient.get<ExceptionRecord>(`/orgs/${orgId}/exceptions/${id}`),

  assign: (orgId: string, id: string, assigneeId: string) =>
    apiClient.post<ExceptionRecord>(`/orgs/${orgId}/exceptions/${id}/assign`, { assigneeId }),

  addComment: (orgId: string, id: string, body: string) =>
    apiClient.post<ExceptionComment>(`/orgs/${orgId}/exceptions/${id}/comments`, { body }),

  transitionStatus: (orgId: string, id: string, dto: TransitionExceptionDto) =>
    apiClient.post<ExceptionRecord>(`/orgs/${orgId}/exceptions/${id}/status`, dto),
};
