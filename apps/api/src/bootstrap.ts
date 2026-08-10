import { ValidationPipe, VersioningType, type INestApplication } from '@nestjs/common';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { ApiExceptionFilter } from './common/api-exception.filter';

export function configureApplication(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  const configuredWebOrigin = process.env.WEB_URL;
  const allowedWebOrigins = new Set(configuredWebOrigin ? [configuredWebOrigin] : []);
  if (configuredWebOrigin && process.env.NODE_ENV !== 'production') {
    const configuredUrl = new URL(configuredWebOrigin);
    if (configuredUrl.hostname === 'localhost' || configuredUrl.hostname === '127.0.0.1') {
      const port = configuredUrl.port ? `:${configuredUrl.port}` : '';
      allowedWebOrigins.add(`${configuredUrl.protocol}//localhost${port}`);
      allowedWebOrigins.add(`${configuredUrl.protocol}//127.0.0.1${port}`);
    }
  }
  const corsOptions: CorsOptions = {
    origin: (origin, callback) => callback(null, !origin || allowedWebOrigins.has(origin)),
    credentials: true,
  };
  app.enableCors(corsOptions);
  app.enableShutdownHooks();

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('RERMS Foundation API').setVersion('1.0').build(),
  );
  SwaggerModule.setup('api/docs', app, document);
  app.useLogger(app.get(Logger));
}
