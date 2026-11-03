import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const REQUEST_ID_HEADER = 'x-request-id';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const rawHeader = req.headers[REQUEST_ID_HEADER];
    const incomingId = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

    // Use incoming ID if provided and valid (UUID or non-empty string without illegal characters)
    let requestId: string;
    if (incomingId && typeof incomingId === 'string' && incomingId.trim().length > 0) {
      requestId = incomingId.trim();
    } else {
      requestId = uuidv4();
    }

    // Attach to request object and normalized headers
    req.id = requestId;
    req.headers[REQUEST_ID_HEADER] = requestId;

    // Set response header
    res.setHeader('X-Request-Id', requestId);

    next();
  }
}
