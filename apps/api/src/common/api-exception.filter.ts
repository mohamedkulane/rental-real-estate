import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ApiErrorResponse } from '@rerms/shared';
import type { Response } from 'express';
import type { CorrelatedRequest } from './correlation-id.middleware';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<CorrelatedRequest>();
    const response = context.getResponse<Response>();
    const isHttp = exception instanceof HttpException;
    const prismaCode =
      exception instanceof Prisma.PrismaClientKnownRequestError ? exception.code : undefined;
    const statusCode = isHttp
      ? exception.getStatus()
      : prismaCode === 'P2025'
        ? HttpStatus.NOT_FOUND
        : prismaCode && ['P2002', 'P2003', 'P2004'].includes(prismaCode)
          ? HttpStatus.CONFLICT
          : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = isHttp ? exception.getResponse() : undefined;
    const validationMessages =
      typeof raw === 'object' && raw && 'message' in raw && Array.isArray(raw.message)
        ? raw.message
        : [];
    const message =
      prismaCode === 'P2025'
        ? 'The requested record was not found.'
        : prismaCode
          ? 'The change conflicts with existing data.'
          : statusCode >= 500
            ? 'An unexpected error occurred.'
            : exception instanceof Error
              ? exception.message
              : 'Request failed.';
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
      correlationId: request.correlationId ?? 'unknown',
    };
    response.status(statusCode).json(body);
  }
}
