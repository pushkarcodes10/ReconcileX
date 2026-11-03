// ReconcileX Centralized API Error Handling

export interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
    details?: string[] | Record<string, any> | null;
    requestId?: string | null;
  };
  message?: string | string[];
  statusCode?: number;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details: string[] | Record<string, any> | null;
  public readonly requestId: string | null;

  constructor(status: number, code: string, message: string, details: string[] | Record<string, any> | null = null, requestId: string | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  static fromResponse(status: number, data: unknown): ApiError {
    const payload = data as ApiErrorPayload | undefined;

    if (payload?.error) {
      const code = payload.error.code || getDefaultCodeForStatus(status);
      const message = payload.error.message || `Request failed with status ${status}`;
      return new ApiError(status, code, message, payload.error.details ?? null, payload.error.requestId ?? null);
    }

    if (payload?.message) {
      const message = Array.isArray(payload.message) ? payload.message.join(', ') : payload.message;
      return new ApiError(status, getDefaultCodeForStatus(status), message);
    }

    return new ApiError(status, getDefaultCodeForStatus(status), `HTTP error ${status}`);
  }

  static isApiError(error: unknown): error is ApiError {
    return error instanceof ApiError;
  }
}

function getDefaultCodeForStatus(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 413:
      return 'PAYLOAD_TOO_LARGE';
    case 422:
      return 'UNPROCESSABLE_ENTITY';
    case 500:
      return 'INTERNAL_SERVER_ERROR';
    default:
      return 'API_ERROR';
  }
}
