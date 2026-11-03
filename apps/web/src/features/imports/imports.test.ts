import { describe, it, expect, vi } from 'vitest';
import { importsApi } from '../../api/endpoints/imports';
import { apiClient } from '../../api/client';

describe('Imports API Integration', () => {
  it('appends file with exact multipart field name "file"', async () => {
    let capturedBody: any = null;

    vi.spyOn(apiClient, 'post').mockImplementation((_url, body) => {
      capturedBody = body;
      return Promise.resolve({
        jobId: 'job-123',
        importId: 'import-456',
        status: 'COMPLETED',
      }) as any;
    });

    const file = new File(['test,csv,data'], 'test.csv', { type: 'text/csv' });
    await importsApi.uploadCsv('org-1', 'ds-1', file);

    expect(capturedBody).toBeInstanceOf(FormData);
    expect(capturedBody.get('file')).toBe(file);
    expect(capturedBody.get('file').name).toBe('test.csv');
  });
});
