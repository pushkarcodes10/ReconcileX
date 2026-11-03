import { apiClient } from '../client';
import { JobRecord, JobType, JobStatus, PaginatedResult } from '../types';
import { normalizePagination } from '../pagination';

export interface QueryJobsParams {
  status?: JobStatus;
  jobType?: JobType;
  referenceType?: string;
  referenceId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const jobsApi = {
  list: async (orgId: string, params?: QueryJobsParams): Promise<PaginatedResult<JobRecord>> => {
    const raw = await apiClient.get<any>(`/orgs/${orgId}/jobs`, {
      params: params as any,
    });
    return normalizePagination<JobRecord>(raw, params?.page || 1, params?.limit || 20);
  },

  getById: (orgId: string, id: string) =>
    apiClient.get<JobRecord>(`/orgs/${orgId}/jobs/${id}`),
};
