import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from './client';
import { ApiError } from './errors';

describe('ApiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes error envelope from backend { error: { code, message, details } }', async () => {
    const errorPayload = {
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Invalid input',
        details: ['email must be an email'],
        requestId: 'req-123',
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => errorPayload,
    } as any);

    await expect(apiClient.get('/test')).rejects.toThrow('Invalid input');

    try {
      await apiClient.get('/test');
    } catch (err: any) {
      expect(ApiError.isApiError(err)).toBe(true);
      expect(err.code).toBe('VALIDATION_FAILED');
      expect(err.status).toBe(400);
      expect(err.details).toEqual(['email must be an email']);
      expect(err.requestId).toBe('req-123');
    }
  });

  it('handles 401 with successful refresh and retries the original request once', async () => {
    let callCount = 0;

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/refresh')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ success: true }),
        } as any);
      }

      callCount++;
      if (callCount === 1) {
        // First call fails with 401
        return Promise.resolve({
          ok: false,
          status: 401,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ error: { code: 'UNAUTHORIZED', message: 'Token expired' } }),
        } as any);
      }

      // Second call after refresh succeeds
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: 'secret-success' }),
      } as any);
    });

    const result = await apiClient.get<{ data: string }>('/protected-resource');
    expect(result).toEqual({ data: 'secret-success' });
    expect(callCount).toBe(2);
  });

  it('uses refresh mutex to avoid concurrent refresh calls on simultaneous 401s', async () => {
    let refreshCalls = 0;
    let resourceCalls = 0;

    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/auth/refresh')) {
        refreshCalls++;
        // Small delay to simulate network latency
        await new Promise((r) => setTimeout(r, 20));
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ success: true }),
        } as any;
      }

      resourceCalls++;
      // Return 401 on initial calls, success on retry
      if (resourceCalls <= 2) {
        return {
          ok: false,
          status: 401,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }),
        } as any;
      }

      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ ok: true }),
      } as any;
    });

    // Launch two simultaneous calls that return 401
    const [res1, res2] = await Promise.all([
      apiClient.get('/res-1'),
      apiClient.get('/res-2'),
    ]);

    expect(res1).toEqual({ ok: true });
    expect(res2).toEqual({ ok: true });
    // Exactly 1 refresh call should have occurred!
    expect(refreshCalls).toBe(1);
  });

  it('throws SESSION_EXPIRED and triggers onAuthFailure if refresh fails', async () => {
    const authFailureListener = vi.fn();
    const unsub = apiClient.onAuthFailure(authFailureListener);

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/refresh')) {
        return Promise.resolve({
          ok: false,
          status: 401,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ error: { code: 'REFRESH_EXPIRED' } }),
        } as any);
      }

      return Promise.resolve({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: { code: 'UNAUTHORIZED' } }),
      } as any);
    });

    await expect(apiClient.get('/user-data')).rejects.toThrow('Your session has expired');
    expect(authFailureListener).toHaveBeenCalledTimes(1);

    unsub();
  });
});
