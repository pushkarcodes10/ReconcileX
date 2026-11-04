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

  it('appends columnMapping when provided to uploadCsv', async () => {
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
    const mapping = { external_id: 'ID', amount: 'Value', date: 'TxnDate', currency: 'Curr' };
    await importsApi.uploadCsv('org-1', 'ds-1', file, mapping);

    expect(capturedBody).toBeInstanceOf(FormData);
    expect(capturedBody.get('columnMapping')).toBe(JSON.stringify(mapping));
  });

  it('generates downloadable error report CSV when downloadErrorReportCsv is called', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      items: [
        {
          id: 'err-1',
          rowNumber: 1214,
          field: 'amount',
          code: 'INVALID_AMOUNT',
          rawValue: '',
          message: 'Missing or invalid amount',
        },
      ],
      total: 1,
      page: 1,
      limit: 1000,
      totalPages: 1,
    } as any);

    // Mock DOM elements and URL methods
    const clickMock = vi.fn();
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      setAttribute: vi.fn(),
      click: clickMock,
    } as any);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as any);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as any);
    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    window.URL.revokeObjectURL = vi.fn();

    await importsApi.downloadErrorReportCsv('org-1', 'imp-1', 'custom_errors.csv');

    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(clickMock).toHaveBeenCalled();
    expect(window.URL.createObjectURL).toHaveBeenCalled();
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});
