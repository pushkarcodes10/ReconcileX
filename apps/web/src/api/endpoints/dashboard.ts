import { apiClient } from '../client';
import {
  DashboardSummary,
  DashboardReconciliation,
  DashboardExceptions,
  AuditLog,
  PaginatedResult,
} from '../types';
import { normalizePagination } from '../pagination';

export interface DashboardReconciliationParams {
  startDate?: string;
  endDate?: string;
}

export interface DashboardActivityParams {
  action?: string;
  page?: number;
  limit?: number;
}

export const dashboardApi = {
  getSummary: (orgId: string) =>
    apiClient.get<DashboardSummary>(`/orgs/${orgId}/dashboard/summary`),

  getReconciliation: (orgId: string, params?: DashboardReconciliationParams) =>
    apiClient.get<DashboardReconciliation>(`/orgs/${orgId}/dashboard/reconciliation`, {
      params: params as any,
    }),

  getExceptions: (orgId: string) =>
    apiClient.get<DashboardExceptions>(`/orgs/${orgId}/dashboard/exceptions`),

  getActivity: async (orgId: string, params?: DashboardActivityParams): Promise<PaginatedResult<AuditLog>> => {
    const raw = await apiClient.get<any>(`/orgs/${orgId}/dashboard/activity`, {
      params: params as any,
    });
    return normalizePagination<AuditLog>(raw, params?.page || 1, params?.limit || 20);
  },
};
