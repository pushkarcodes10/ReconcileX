import { apiClient } from '../client';
import {
  ConfirmDatasetPayload,
  ScreenshotDatasetDetail,
  ScreenshotExtractedRecord,
  UpdateExtractedRecordPayload,
} from '../types';

export interface ExtractScreenshotResponse {
  amount: number;
  amountMinor: number;
  currency: string;
  transactionDate: string;
  externalId: string;
  reference?: string;
  externalTxnId?: string;
  merchantOrOrderId?: string;
  txnType?: string;
  description?: string;
  confidenceScore: number;
  rawOcrText: string;
  extractionMethod: 'GEMINI_VISION' | 'TESSERACT_OCR';
}

export interface IngestScreenshotPayload {
  dataSourceId: string;
  externalId: string;
  amount: number;
  currency: string;
  transactionDate: string;
  reference?: string;
  externalTxnId?: string;
  merchantOrOrderId?: string;
  txnType?: string;
  metadata?: Record<string, unknown>;
}

export interface IngestScreenshotResponse {
  id: string;
  organizationId: string;
  dataSourceId: string;
  externalId: string;
  amountMinor: number;
  currency: string;
  transactionDate: string;
  status: string;
  reference?: string | null;
  createdAt: string;
  message: string;
}

export const screenshotApi = {
  extractScreenshot: (orgId: string, file: File): Promise<ExtractScreenshotResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post<ExtractScreenshotResponse>(
      `/orgs/${orgId}/screenshot/extract`,
      formData
    );
  },

  ingestScreenshot: (
    orgId: string,
    payload: IngestScreenshotPayload
  ): Promise<IngestScreenshotResponse> => {
    return apiClient.post<IngestScreenshotResponse>(
      `/orgs/${orgId}/screenshot/ingest`,
      payload
    );
  },

  // Dataset Ingestion & Review Workflow
  createDataset: (
    orgId: string,
    name: string,
    files: File[],
    dataSourceId?: string
  ): Promise<ScreenshotDatasetDetail> => {
    const formData = new FormData();
    formData.append('name', name);
    if (dataSourceId) {
      formData.append('dataSourceId', dataSourceId);
    }
    for (const f of files) {
      formData.append('files', f);
    }
    return apiClient.post<ScreenshotDatasetDetail>(
      `/orgs/${orgId}/screenshot/datasets`,
      formData
    );
  },

  getDatasets: (orgId: string): Promise<ScreenshotDatasetDetail[]> => {
    return apiClient.get<ScreenshotDatasetDetail[]>(`/orgs/${orgId}/screenshot/datasets`);
  },

  getDatasetById: (orgId: string, datasetId: string): Promise<ScreenshotDatasetDetail> => {
    return apiClient.get<ScreenshotDatasetDetail>(
      `/orgs/${orgId}/screenshot/datasets/${datasetId}`
    );
  },

  getFilePreviewUrl: (
    orgId: string,
    fileId: string
  ): Promise<{ previewUrl: string; expiresInSeconds: number }> => {
    return apiClient.get<{ previewUrl: string; expiresInSeconds: number }>(
      `/orgs/${orgId}/screenshot/files/${fileId}/preview`
    );
  },

  updateExtractedRecord: (
    orgId: string,
    recordId: string,
    payload: UpdateExtractedRecordPayload
  ): Promise<ScreenshotExtractedRecord> => {
    return apiClient.patch<ScreenshotExtractedRecord>(
      `/orgs/${orgId}/screenshot/records/${recordId}`,
      payload
    );
  },

  confirmDataset: (
    orgId: string,
    datasetId: string,
    payload: ConfirmDatasetPayload
  ): Promise<ScreenshotDatasetDetail> => {
    return apiClient.post<ScreenshotDatasetDetail>(
      `/orgs/${orgId}/screenshot/datasets/${datasetId}/confirm`,
      payload
    );
  },
};
