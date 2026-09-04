import {
  ArgumentsHost,
  Catch,
  HttpException,
  Inject,
  Injectable,
  type CanActivate,
  type ExceptionFilter,
  type ExecutionContext,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { createHmac } from 'node:crypto';
import type { ApiEnvironment } from '@rerms/config';
import { API_ENVIRONMENT } from '../config/foundation-config.module';
import { RedisService } from '../infrastructure/redis.service';
import type { AuthenticatedRequest } from '../security/security.types';

/** Errors intentionally exclude submitted values, database text and protected search. */
@Catch()
export class CrmExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<AuthenticatedRequest>();
    const http = error instanceof HttpException ? error : undefined;
    const db = error instanceof Prisma.PrismaClientKnownRequestError ? error : undefined;
    const statusCode =
      http?.getStatus() ??
      (db?.code === 'P2025'
        ? 404
        : db && ['P2002', 'P2003', 'P2004', 'P2010', 'P2034'].includes(db.code)
          ? 409
          : 500);
    const fallback =
      statusCode === 400
        ? 'CRM_VALIDATION_FAILED'
        : statusCode === 401
          ? 'CRM_UNAUTHENTICATED'
          : statusCode === 403
            ? 'CRM_FORBIDDEN'
            : statusCode === 404
              ? 'CRM_NOT_FOUND'
              : statusCode === 409
                ? 'CRM_CONFLICT'
                : statusCode === 429
                  ? 'CRM_RATE_LIMITED'
                  : 'CRM_INTERNAL_ERROR';
    const code = http && /^CRM_[A-Z_]+$/.test(http.message) ? http.message : fallback;
    const messages: Record<string, string> = {
      CRM_VALIDATION_FAILED: 'The request is invalid.',
      CRM_UNAUTHENTICATED: 'Authentication is required.',
      CRM_FORBIDDEN: 'This action is not permitted.',
      CRM_NOT_FOUND: 'The requested record was not found.',
      CRM_VERSION_CONFLICT: 'This record changed. Refresh and try again.',
      CRM_CONFLICT: 'The change conflicts with existing data.',
      CRM_RATE_LIMITED: 'Too many searches. Try again later.',
      CRM_INTERNAL_ERROR: 'An unexpected error occurred.',
    };
    context
      .getResponse<Response>()
      .status(statusCode)
      .json({
        statusCode,
        code,
        message: messages[code] ?? 'The requested CRM action cannot be completed.',
        details: [],
        correlationId: request.correlationId ?? 'unknown',
      });
  }
}

@Injectable()
export class CrmSearchGuard implements CanActivate {
  constructor(
    private readonly redis: RedisService,
    @Inject(API_ENVIRONMENT) private readonly environment: ApiEnvironment,
  ) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (typeof request.query.search !== 'string' || !request.query.search.trim()) return true;
    const principal = request.principal;
    const identity = createHmac('sha256', this.environment.AUTH_RATE_LIMIT_KEY)
      .update(`crm-search:v1\0${principal.companyId}|${principal.userId}`)
      .digest('hex');
    const key = `rerms:crm-search:${Math.floor(Date.now() / 60000)}:${identity}`;
    const result = await this.redis.client.multi().incr(key).expire(key, 120).exec();
    if (!result || result[0]?.[0]) throw new HttpException('CRM_INTERNAL_ERROR', 503);
    if (Number(result[0]?.[1]) > 60) throw new HttpException('CRM_RATE_LIMITED', 429);
    return true;
  }
}
