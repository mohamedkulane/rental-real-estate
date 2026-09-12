import { type MiddlewareConsumer, Module, type NestModule, RequestMethod } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { CORRELATION_ID_HEADER } from '@rerms/shared';
import { CorrelationIdMiddleware } from './common/correlation-id.middleware';
import { crmHttpLogPrivacy, crmSafeRequestId } from './common/crm-log-privacy';
import { FoundationConfigModule } from './config/foundation-config.module';
import { DatabaseModule } from './database/database.module';
import { FoundationController } from './foundation/foundation.controller';
import { HealthController } from './health/health.controller';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { Phase9Module } from './phase9.module';

@Module({
  imports: [
    FoundationConfigModule,
    DatabaseModule,
    InfrastructureModule,
    Phase9Module,
    LoggerModule.forRoot({
      forRoutes: [{ path: '{*path}', method: RequestMethod.ALL }],
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        genReqId: (request) =>
          crmSafeRequestId(request, request.headers[CORRELATION_ID_HEADER] ?? request.id),
        customProps: () => ({ environment: process.env.NODE_ENV ?? 'development' }),
        ...crmHttpLogPrivacy,
        redact: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.password',
          'req.body.currentPassword',
          'req.body.newPassword',
          'req.body.token',
        ],
      },
    }),
  ],
  controllers: [HealthController, FoundationController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(CorrelationIdMiddleware)
      .forRoutes({ path: '{*path}', method: RequestMethod.ALL });
  }
}
