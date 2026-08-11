import { Injectable, type NestMiddleware } from '@nestjs/common';
import { CORRELATION_ID_HEADER, uuidv7 } from '@rerms/shared';
import type { NextFunction, Request, Response } from 'express';

export interface CorrelatedRequest extends Request {
  correlationId?: string;
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(request: CorrelatedRequest, response: Response, next: NextFunction): void {
    const supplied = request.header(CORRELATION_ID_HEADER);
    const correlationId = supplied && supplied.length <= 128 ? supplied : uuidv7();
    request.correlationId = correlationId;
    request.headers[CORRELATION_ID_HEADER] = correlationId;
    response.setHeader(CORRELATION_ID_HEADER, correlationId);
    next();
  }
}
