import { apiClient } from '../client';
import { DataSource, DataSourceType, DataSourceStatus, ColumnMapping, PaginatedResult } from '../types';
import { normalizePagination } from '../pagination';

export interface CreateDataSourceDto {
  name: string;
  type: DataSourceType;
  columnMapping: ColumnMapping;
  direction?: 'INBOUND' | 'OUTBOUND' | 'NEUTRAL';
}

export interface UpdateDataSourceDto {
  name?: string;
  type?: DataSourceType;
  columnMapping?: ColumnMapping;
  status?: DataSourceStatus;
}

export interface QueryDataSourcesParams {
  type?: DataSourceType;
  status?: DataSourceStatus;
  page?: number;
  limit?: number;
}

export const dataSourcesApi = {
  create: (orgId: string, dto: CreateDataSourceDto) =>
    apiClient.post<DataSource>(`/orgs/${orgId}/data-sources`, dto),

  list: async (orgId: string, params: QueryDataSourcesParams = { page: 1, limit: 50 }): Promise<PaginatedResult<DataSource>> => {
    // Note: Always passing page and limit guarantees normalized paginated response shape
    const raw = await apiClient.get<any>(`/orgs/${orgId}/data-sources`, {
      params: params as any,
    });
    return normalizePagination<DataSource>(raw, params.page || 1, params.limit || 50);
  },

  getById: (orgId: string, id: string) =>
    apiClient.get<DataSource>(`/orgs/${orgId}/data-sources/${id}`),

  update: (orgId: string, id: string, dto: UpdateDataSourceDto) =>
    apiClient.patch<DataSource>(`/orgs/${orgId}/data-sources/${id}`, dto),

  delete: (orgId: string, id: string) =>
    apiClient.delete<{ success: boolean }>(`/orgs/${orgId}/data-sources/${id}`),
};
