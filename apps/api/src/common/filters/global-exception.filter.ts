import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details: unknown;
    requestId: string;
  };
}

const HTTP_STATUS_CODE_MAP: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'METHOD_NOT_ALLOWED',
  [HttpStatus.NOT_ACCEPTABLE]: 'NOT_ACCEPTABLE',
  [HttpStatus.REQUEST_TIMEOUT]: 'REQUEST_TIMEOUT',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.GONE]: 'GONE',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'UNSUPPORTED_MEDIA_TYPE',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_SERVER_ERROR',
  [HttpStatus.BAD_GATEWAY]: 'BAD_GATEWAY',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
  [HttpStatus.GATEWAY_TIMEOUT]: 'GATEWAY_TIMEOUT',
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const rawRequestId =
      request.id ||
      (request.headers['x-request-id'] as string) ||
      (response.getHeader('x-request-id') as string) ||
      uuidv4();
    const requestId = String(rawRequestId);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';
    let details: unknown = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = HTTP_STATUS_CODE_MAP[status] || 'HTTP_ERROR';

      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;

        if (typeof resp.code === 'string') {
          code = resp.code;
        }

        if (Array.isArray(resp.message)) {
          // Class validator error format
          message = 'Validation failed';
          details = resp.message;
        } else if (typeof resp.message === 'string') {
          message = resp.message;
          details = resp.details ?? null;
        } else if (resp.error && typeof resp.error === 'string') {
          message = resp.error;
        }

        if (resp.details !== undefined) {
          details = resp.details;
        }
      }
    } else {
      // Unhandled / unexpected exception
      // Never expose internal database messages or stack traces
      this.logger.error(
        `Unhandled Exception [Request ID: ${requestId}] [${request.method} ${request.url}]: ${
          exception instanceof Error ? exception.message : String(exception)
        }`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const errorResponse: ApiErrorResponse = {
      error: {
        code,
        message,
        details,
        requestId,
      },
    };

    response.status(status).json(errorResponse);
  }
}
