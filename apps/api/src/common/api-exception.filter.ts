import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ApiErrorResponse } from '@rerms/shared';
import type { Response } from 'express';
import type { CorrelatedRequest } from './correlation-id.middleware';
import { crmSafeCorrelationId, isCrmRequest } from './crm-log-privacy';

function readPostgresMessage(exception: unknown): string {
  const parts: string[] = [];
  if (
    exception instanceof Prisma.PrismaClientKnownRequestError &&
    typeof exception.meta?.message === 'string'
  ) {
    parts.push(exception.meta.message);
  }
  if (exception instanceof Error) {
    parts.push(exception.message);
    if (exception.cause instanceof Error) parts.push(exception.cause.message);
  }
  return parts.join('\n');
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<CorrelatedRequest>();
    const response = context.getResponse<Response>();
    const isHttp = exception instanceof HttpException;
    const prismaCode =
      exception instanceof Prisma.PrismaClientKnownRequestError ? exception.code : undefined;
    const databaseMessage = readPostgresMessage(exception);
    const integrityMessage = databaseMessage.includes('ownership must total')
      ? 'Active Property ownership must total 100% for the effective period.'
      : databaseMessage.includes('payout entitlement must total')
        ? 'Active Property payout entitlement must total 100% for the effective period.'
        : databaseMessage.includes('exactly one operating branch')
          ? 'Active Property requires exactly one operating branch for the effective period.'
          : databaseMessage.includes('usable area')
            ? 'The RentableSpace area conflicts with its effective parent configuration.'
            : databaseMessage.includes('incompatible active Service Engagement')
              ? 'An incompatible active Service Engagement already covers this scope and effective period.'
              : databaseMessage.includes('Company Owned engagement requires')
                ? 'Company Owned requires effective Property ownership by the Company Party for the full Engagement period.'
                : databaseMessage.includes('Service Engagement Rentable Space')
                  ? 'The Rentable Space must belong to the selected Property.'
                  : databaseMessage.includes('Service Engagement Property')
                    ? 'The Property must belong to the current Company.'
                    : databaseMessage.includes('Service Engagement history is append-only')
                      ? 'Service Engagement lifecycle history is append-only.'
                      : undefined;
    const statusCode = isHttp
      ? exception.getStatus()
      : integrityMessage
        ? HttpStatus.CONFLICT
        : prismaCode === 'P2025'
          ? HttpStatus.NOT_FOUND
          : prismaCode && ['P2002', 'P2003', 'P2004', 'P2010'].includes(prismaCode)
            ? HttpStatus.CONFLICT
            : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = isHttp ? exception.getResponse() : undefined;
    const validationMessages =
      typeof raw === 'object' && raw && 'message' in raw && Array.isArray(raw.message)
        ? raw.message
        : [];
    const httpMessage =
      typeof raw === 'string'
        ? raw
        : typeof raw === 'object' && raw && 'message' in raw && typeof raw.message === 'string'
          ? raw.message
          : undefined;
    const message =
      prismaCode === 'P2025'
        ? 'The requested record was not found.'
        : integrityMessage
          ? integrityMessage
          : prismaCode
            ? 'The change conflicts with existing data.'
            : statusCode >= 500
              ? 'An unexpected error occurred.'
              : httpMessage
                ? httpMessage
                : exception instanceof Error
                  ? exception.message
                  : 'Request failed.';
    const correlationId = request.correlationId ?? 'unknown';
    if (statusCode >= 500) {
      if (isCrmRequest(request)) {
        // CRM URLs, query values, parser payloads, exception messages, and
        // stacks may contain protected contact/free-text data. The pino
        // request serializer protects the request-completed record; this
        // branch protects the independent global-filter error record too.
        this.logger.error(
          'CRM request failed [' + crmSafeCorrelationId(correlationId) + ']',
          'CRM',
        );
      } else {
        const method = request.method ?? 'UNKNOWN';
        const path = request.originalUrl ?? request.url ?? 'unknown';
        this.logger.error(
          'Unhandled API error ' + method + ' ' + path + ' [' + correlationId + ']',
          exception instanceof Error ? exception.stack : undefined,
        );
      }
    }
    const body: ApiErrorResponse = {
      statusCode,
      code: validationMessages.length
        ? 'VALIDATION_ERROR'
        : prismaCode
          ? prismaCode === 'P2025'
            ? 'NOT_FOUND'
            : 'DATA_CONFLICT'
          : isHttp
            ? 'HTTP_ERROR'
            : 'INTERNAL_ERROR',
      message,
      details: validationMessages,
      correlationId,
    };
    response.status(statusCode).json(body);
  }
}
