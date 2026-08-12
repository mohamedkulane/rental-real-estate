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
    const databaseMessage =
      exception instanceof Prisma.PrismaClientKnownRequestError &&
      typeof exception.meta?.message === 'string'
        ? exception.meta.message
        : '';
    const integrityMessage = databaseMessage.includes('ownership must total')
      ? 'Active Property ownership must total 100% for the effective period.'
      : databaseMessage.includes('payout entitlement must total')
        ? 'Active Property payout entitlement must total 100% for the effective period.'
        : databaseMessage.includes('exactly one operating branch')
          ? 'Active Property requires exactly one operating branch for the effective period.'
          : databaseMessage.includes('usable area')
            ? 'The RentableSpace area conflicts with its effective parent configuration.'
            : undefined;
    const statusCode = isHttp
      ? exception.getStatus()
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
      const method = request.method ?? 'UNKNOWN';
      const path = request.originalUrl ?? request.url ?? 'unknown';
      this.logger.error(
        'Unhandled API error ' + method + ' ' + path + ' [' + correlationId + ']',
        exception instanceof Error ? exception.stack : undefined,
      );
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
