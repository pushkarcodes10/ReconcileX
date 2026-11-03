import { apiClient } from '../client';
import {
  ImportRecord,
  ImportError,
  DuplicateCandidate,
  PaginatedResult,
  ImportStatus,
  DuplicateStatus,
} from '../types';
import { normalizePagination } from '../pagination';

export interface UploadImportResponse {
  jobId: string;
  importId: string;
  status: ImportStatus;
  duplicateFile?: string;
  totalRecords?: number;
  validRecords?: number;
  invalidRecords?: number;
  duplicateRecords?: number;
}

export interface QueryImportsParams {
  dataSourceId?: string;
  status?: ImportStatus;
  page?: number;
  limit?: number;
}

export interface QueryDuplicatesParams {
  importId?: string;
  dataSourceId?: string;
  status?: DuplicateStatus;
  page?: number;
  limit?: number;
}

export const importsApi = {
  uploadCsv: (orgId: string, dataSourceId: string, file: File) => {
    const formData = new FormData();
    // Multipart field name MUST be 'file' per backend specs
    formData.append('file', file);
    return apiClient.post<UploadImportResponse>(
      `/orgs/${orgId}/data-sources/${dataSourceId}/imports`,
      formData
    );
  },

  listImports: async (orgId: string, params?: QueryImportsParams): Promise<PaginatedResult<ImportRecord>> => {
    const raw = await apiClient.get<any>(`/orgs/${orgId}/imports`, {
      params: params as any,
    });
    return normalizePagination<ImportRecord>(raw, params?.page || 1, params?.limit || 20);
  },

  getImportById: (orgId: string, importId: string) =>
    apiClient.get<ImportRecord>(`/orgs/${orgId}/imports/${importId}`),

  getImportStatus: (orgId: string, importId: string) =>
    apiClient.get<ImportRecord>(`/orgs/${orgId}/imports/${importId}/status`),

  getImportErrors: async (orgId: string, importId: string, params?: { page?: number; limit?: number }): Promise<PaginatedResult<ImportError>> => {
    const raw = await apiClient.get<any>(`/orgs/${orgId}/imports/${importId}/errors`, {
      params: params as any,
    });
    return normalizePagination<ImportError>(raw, params?.page || 1, params?.limit || 50);
  },

  listDuplicateCandidates: async (orgId: string, params?: QueryDuplicatesParams): Promise<PaginatedResult<DuplicateCandidate>> => {
    const raw = await apiClient.get<any>(`/orgs/${orgId}/duplicate-candidates`, {
      params: params as any,
    });
    return normalizePagination<DuplicateCandidate>(raw, params?.page || 1, params?.limit || 20);
  },
};
