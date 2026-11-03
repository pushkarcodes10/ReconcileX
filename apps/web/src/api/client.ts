// ReconcileX API Client with Cookie Authentication & Refresh Mutex

import { ApiError } from './errors';

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  params?: Record<string, string | number | boolean | undefined | null>;
  _isRetry?: boolean;
}

export type AuthFailureCallback = () => void;

class ApiClient {
  private baseURL: string;
  private refreshPromise: Promise<boolean> | null = null;
  private onAuthFailureListeners: Set<AuthFailureCallback> = new Set();

  constructor() {
    this.baseURL = (import.meta.env.VITE_API_BASE_URL as string) || '/api/v1';
  }

  public setBaseURL(url: string) {
    this.baseURL = url;
  }

  public getBaseURL(): string {
    return this.baseURL;
  }

  public onAuthFailure(callback: AuthFailureCallback): () => void {
    this.onAuthFailureListeners.add(callback);
    return () => {
      this.onAuthFailureListeners.delete(callback);
    };
  }

  private notifyAuthFailure() {
    this.onAuthFailureListeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error('Error in auth failure listener', err);
      }
    });
  }

  /**
   * Refresh session mutex: Ensures only one refresh request runs at any time.
   */
  private async refreshSession(): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const refreshUrl = `${this.baseURL}/auth/refresh`;
        const res = await fetch(refreshUrl, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (res.ok) {
          return true;
        }

        return false;
      } catch {
        return false;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Main request method
   */
  public async request<T>(path: string, options: RequestOptions & { body?: unknown } = {}): Promise<T> {
    const { params, _isRetry, body, headers: customHeaders, ...fetchInit } = options;

    let url = path.startsWith('http') ? path : `${this.baseURL}${path.startsWith('/') ? path : `/${path}`}`;

    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          searchParams.append(key, String(val));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += (url.includes('?') ? '&' : '?') + queryString;
      }
    }

    const headers = new Headers(customHeaders);
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }

    let requestBody: BodyInit | undefined = undefined;

    if (body !== undefined && body !== null) {
      if (body instanceof FormData) {
        requestBody = body;
        // Note: Do NOT set Content-Type header; browser must set multipart/form-data boundary
      } else if (typeof body === 'object') {
        requestBody = JSON.stringify(body);
        if (!headers.has('Content-Type')) {
          headers.set('Content-Type', 'application/json');
        }
      } else {
        requestBody = String(body);
      }
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...fetchInit,
        headers,
        body: requestBody,
        credentials: 'include', // Crucial for httpOnly access/refresh tokens
      });
    } catch (networkError: any) {
      throw new ApiError(0, 'NETWORK_ERROR', networkError?.message || 'Network request failed');
    }

    // Handle 401 Unauthorized with single retry and refresh mutex
    const isAuthEndpoint = path.includes('/auth/login') || path.includes('/auth/refresh') || path.includes('/auth/register');

    if (response.status === 401 && !isAuthEndpoint && !_isRetry) {
      const refreshed = await this.refreshSession();
      if (refreshed) {
        // Retry the original request once
        return this.request<T>(path, {
          ...options,
          _isRetry: true,
        });
      } else {
        // Refresh failed: session expired
        this.notifyAuthFailure();
        throw new ApiError(401, 'SESSION_EXPIRED', 'Your session has expired. Please log in again.');
      }
    }

    // Parse JSON or text
    let responseData: any = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        responseData = await response.json();
      } catch {
        responseData = null;
      }
    } else {
      try {
        responseData = await response.text();
      } catch {
        responseData = null;
      }
    }

    if (!response.ok) {
      throw ApiError.fromResponse(response.status, responseData);
    }

    return responseData as T;
  }

  public get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  public post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'POST', body });
  }

  public patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'PATCH', body });
  }

  public put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'PUT', body });
  }

  public delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
