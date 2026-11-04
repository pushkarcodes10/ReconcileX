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
});
