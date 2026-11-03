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
      sourceA: 'ds-a',
      sourceB: 'ds-b',
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
    };

    await reconciliationApi.createRun('org-123', dto, 'custom-idempotency-uuid-123');

    expect(capturedOptions?.headers?.['Idempotency-Key']).toBe('custom-idempotency-uuid-123');
  });
});
