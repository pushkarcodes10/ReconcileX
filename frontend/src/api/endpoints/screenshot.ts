import { apiClient } from '../client';

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
};
