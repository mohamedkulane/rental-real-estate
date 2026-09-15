import 'reflect-metadata';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { NestFactory } from '@nestjs/core';
import { parseApiEnvironment } from '@rerms/config';
import { AppModule } from './app.module';
import { configureApplication } from './bootstrap';

function loadRootEnvironment(): void {
  try {
    loadEnvFile(resolve(__dirname, '../../../.env'));
  } catch (error) {
    if (!process.env.DATABASE_URL) throw error;
  }
}

async function bootstrap(): Promise<void> {
  loadRootEnvironment();
  const environment = parseApiEnvironment(process.env);
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  configureApplication(app);
  await app.listen(environment.API_PORT);
}

void bootstrap();


