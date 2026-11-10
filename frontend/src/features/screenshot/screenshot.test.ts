import { describe, it, expect, vi } from 'vitest';
import { screenshotApi } from '../../api/endpoints/screenshot';
import { apiClient } from '../../api/client';

describe('Screenshot API Integration', () => {
  it('extractScreenshot sends multipart FormData with field "file" to /orgs/:orgId/screenshot/extract', async () => {
    let capturedUrl = '';
    let capturedBody: any = null;

    vi.spyOn(apiClient, 'post').mockImplementation((url, body) => {
      capturedUrl = url;
      capturedBody = body;
      return Promise.resolve({
        amount: 1499.0,
        amountMinor: 149900,
        currency: 'INR',
        transactionDate: '2026-09-02',
        externalId: 'ORD-1002',
        reference: 'ORD-1002',
        confidenceScore: 92,
        rawOcrText: 'Payment of ₹1,499.00 to Merchant ORD-1002',
        extractionMethod: 'TESSERACT_OCR',
      }) as any;
    });

    const file = new File(['fake-image-bytes'], 'payment_receipt.png', { type: 'image/png' });
    const result = await screenshotApi.extractScreenshot('org-uuid-123', file);

    expect(capturedUrl).toBe('/orgs/org-uuid-123/screenshot/extract');
    expect(capturedBody).toBeInstanceOf(FormData);
    expect(capturedBody.get('file')).toBe(file);
    expect(result.amount).toBe(1499.0);
    expect(result.currency).toBe('INR');
    expect(result.externalId).toBe('ORD-1002');
  });

  it('ingestScreenshot sends transaction payload to /orgs/:orgId/screenshot/ingest', async () => {
    let capturedUrl = '';
    let capturedBody: any = null;

    vi.spyOn(apiClient, 'post').mockImplementation((url, body) => {
      capturedUrl = url;
      capturedBody = body;
      return Promise.resolve({
        id: 'txn-created-999',
        organizationId: 'org-uuid-123',
        dataSourceId: 'ds-pg-456',
        externalId: 'ORD-1002',
        amountMinor: 149900,
        currency: 'INR',
        transactionDate: '2026-09-02T00:00:00.000Z',
        status: 'UNMATCHED',
        reference: 'ORD-1002',
        createdAt: '2026-11-04T12:00:00.000Z',
        message: 'Screenshot transaction successfully ingested into ledger',
      }) as any;
    });

    const payload = {
      dataSourceId: 'ds-pg-456',
      externalId: 'ORD-1002',
      amount: 1499.0,
      currency: 'INR',
      transactionDate: '2026-09-02',
      reference: 'ORD-1002',
      txnType: 'PAYMENT',
    };

    const res = await screenshotApi.ingestScreenshot('org-uuid-123', payload);

    expect(capturedUrl).toBe('/orgs/org-uuid-123/screenshot/ingest');
    expect(capturedBody).toEqual(payload);
    expect(res.id).toBe('txn-created-999');
    expect(res.status).toBe('UNMATCHED');
    expect(res.amountMinor).toBe(149900);
  });

  it('createDataset sends batch files and metadata to /orgs/:orgId/screenshot/datasets', async () => {
    let capturedUrl = '';
    let capturedBody: any = null;

    vi.spyOn(apiClient, 'post').mockImplementation((url, body) => {
      capturedUrl = url;
      capturedBody = body;
      return Promise.resolve({
        id: 'dataset-123',
        organizationId: 'org-uuid-123',
        name: 'UPI Inward September',
        status: 'REVIEW_REQUIRED',
        totalFiles: 2,
        totalRecords: 2,
        confirmedRecords: 0,
        createdAt: '2026-11-10T12:00:00Z',
        files: [],
        records: [],
      }) as any;
    });

    const file1 = new File(['img1'], 'rec1.png', { type: 'image/png' });
    const file2 = new File(['img2'], 'rec2.jpg', { type: 'image/jpeg' });
    const dataset = await screenshotApi.createDataset('org-uuid-123', 'UPI Inward September', [file1, file2], 'ds-source-1');

    expect(capturedUrl).toBe('/orgs/org-uuid-123/screenshot/datasets');
    expect(capturedBody).toBeInstanceOf(FormData);
    expect(capturedBody.get('name')).toBe('UPI Inward September');
    expect(capturedBody.get('dataSourceId')).toBe('ds-source-1');
    expect(capturedBody.getAll('files')).toHaveLength(2);
    expect(dataset.status).toBe('REVIEW_REQUIRED');
  });

  it('getFilePreviewUrl requests presigned url from /orgs/:orgId/screenshot/files/:fileId/preview', async () => {
    let capturedUrl = '';

    vi.spyOn(apiClient, 'get').mockImplementation((url) => {
      capturedUrl = url;
      return Promise.resolve({
        previewUrl: 'https://minio.local/reconcilex-private/orgs/org-123/receipt.png?X-Amz-Signature=abc',
        expiresInSeconds: 3600,
      }) as any;
    });

    const res = await screenshotApi.getFilePreviewUrl('org-uuid-123', 'file-456');

    expect(capturedUrl).toBe('/orgs/org-uuid-123/screenshot/files/file-456/preview');
    expect(res.previewUrl).toContain('X-Amz-Signature=abc');
    expect(res.expiresInSeconds).toBe(3600);
  });

  it('updateExtractedRecord sends patch payload to /orgs/:orgId/screenshot/records/:recordId', async () => {
    let capturedUrl = '';
    let capturedBody: any = null;

    vi.spyOn(apiClient, 'patch').mockImplementation((url, body) => {
      capturedUrl = url;
      capturedBody = body;
      return Promise.resolve({
        id: 'record-789',
        amount: 2500,
        userCorrected: true,
      }) as any;
    });

    const res = await screenshotApi.updateExtractedRecord('org-uuid-123', 'record-789', {
      amount: 2500,
      reference: 'TXN-CORRECTED',
    });

    expect(capturedUrl).toBe('/orgs/org-uuid-123/screenshot/records/record-789');
    expect(capturedBody).toEqual({ amount: 2500, reference: 'TXN-CORRECTED' });
    expect(res.userCorrected).toBe(true);
  });

  it('confirmDataset sends confirmation and target name to /confirm endpoint', async () => {
    let capturedUrl = '';
    let capturedBody: any = null;

    vi.spyOn(apiClient, 'post').mockImplementation((url, body) => {
      capturedUrl = url;
      capturedBody = body;
      return Promise.resolve({
        id: 'dataset-123',
        status: 'READY',
        confirmedRecords: 5,
      }) as any;
    });

    const res = await screenshotApi.confirmDataset('org-uuid-123', 'dataset-123', {
      dataSourceName: 'Verified Receipt Dataset',
    });

    expect(capturedUrl).toBe('/orgs/org-uuid-123/screenshot/datasets/dataset-123/confirm');
    expect(capturedBody).toEqual({ dataSourceName: 'Verified Receipt Dataset' });
    expect(res.status).toBe('READY');
    expect(res.confirmedRecords).toBe(5);
  });
});
