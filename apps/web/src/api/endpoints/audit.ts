import { apiClient } from '../client';
import { AuditLog, PaginatedResult } from '../types';
import { normalizePagination } from '../pagination';

export interface QueryAuditLogsParams {
  action?: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const auditApi = {
  list: async (orgId: string, params?: QueryAuditLogsParams): Promise<PaginatedResult<AuditLog>> => {
    const raw = await apiClient.get<any>(`/orgs/${orgId}/audit-logs`, {
      params: params as any,
    });
    return normalizePagination<AuditLog>(raw, params?.page || 1, params?.limit || 20);
  },

  getById: (orgId: string, id: string) =>
    apiClient.get<AuditLog>(`/orgs/${orgId}/audit-logs/${id}`),
};
