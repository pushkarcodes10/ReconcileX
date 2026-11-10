import { describe, it, expect, vi } from 'vitest';
import { reconciliationApi } from '../../api/endpoints/reconciliation';
import { apiClient } from '../../api/client';

describe('Reconciliation API Integration', () => {
  it('sends Idempotency-Key header on run creation', async () => {
    let capturedOptions: any = null;

    vi.spyOn(apiClient, 'post').mockImplementation((_url, _body, options) => {
      capturedOptions = options;
      return Promise.resolve({
        jobId: 'job-recon-1',
        runId: 'run-recon-1',
        status: 'PROCESSING',
        run: {} as any,
      });
    });

    const dto = {
      reconciliationType: 'THREE_SOURCE' as const,
      sourceA: 'ds-a',
      sourceB: 'ds-b',
      sourceC: 'ds-c',
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      config: {
        dateToleranceDays: 3,
      },
    };

    await reconciliationApi.createRun('org-123', dto, 'custom-idempotency-uuid-123');

    expect(capturedOptions?.headers?.['Idempotency-Key']).toBe('custom-idempotency-uuid-123');
  });

  it('supports three-source run creation parameters in DTO', async () => {
    let capturedBody: any = null;

    vi.spyOn(apiClient, 'post').mockImplementation((_url, body) => {
      capturedBody = body;
      return Promise.resolve({
        jobId: 'job-recon-2',
        runId: 'run-recon-2',
        status: 'COMPLETED',
        run: {
          id: 'run-recon-2',
          reconciliationType: 'THREE_SOURCE',
          sourceA: 'ds-a',
          sourceB: 'ds-b',
          sourceC: 'ds-c',
          fullyMatchedCount: 5,
          partiallyMatchedCount: 2,
          discrepancyCount: 1,
        } as any,
      });
    });

    const res = await reconciliationApi.createRun('org-123', {
      reconciliationType: 'THREE_SOURCE',
      sourceA: 'ds-a',
      sourceB: 'ds-b',
      sourceC: 'ds-c',
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
      config: {
        dateToleranceDays: 2,
      },
    });

    expect(capturedBody.reconciliationType).toBe('THREE_SOURCE');
    expect(capturedBody.sourceC).toBe('ds-c');
    expect(res.run.reconciliationType).toBe('THREE_SOURCE');
    expect(res.run.fullyMatchedCount).toBe(5);
  });

  it('supports four-source (4-way omni) run creation parameters in DTO', async () => {
    let capturedBody: any = null;

    vi.spyOn(apiClient, 'post').mockImplementation((_url, body) => {
      capturedBody = body;
      return Promise.resolve({
        jobId: 'job-recon-4',
        runId: 'run-recon-4',
        status: 'COMPLETED',
        run: {
          id: 'run-recon-4',
          reconciliationType: 'FOUR_SOURCE',
          sourceA: 'ds-orders',
          sourceB: 'ds-gateway',
          sourceC: 'ds-bank',
          sourceD: 'ds-screenshot-feed',
          fullyMatchedCount: 8,
          partiallyMatchedCount: 3,
          discrepancyCount: 1,
        } as any,
      });
    });

    const res = await reconciliationApi.createRun('org-123', {
      reconciliationType: 'FOUR_SOURCE',
      sourceA: 'ds-orders',
      sourceB: 'ds-gateway',
      sourceC: 'ds-bank',
      sourceD: 'ds-screenshot-feed',
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
      config: {
        dateToleranceDays: 3,
      },
    });

    expect(capturedBody.reconciliationType).toBe('FOUR_SOURCE');
    expect(capturedBody.sourceA).toBe('ds-orders');
    expect(capturedBody.sourceB).toBe('ds-gateway');
    expect(capturedBody.sourceC).toBe('ds-bank');
    expect(capturedBody.sourceD).toBe('ds-screenshot-feed');
    expect(res.run.reconciliationType).toBe('FOUR_SOURCE');
    expect(res.run.sourceD).toBe('ds-screenshot-feed');
    expect(res.run.fullyMatchedCount).toBe(8);
  });
});
