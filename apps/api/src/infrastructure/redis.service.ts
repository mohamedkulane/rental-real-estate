import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import type { ApiEnvironment } from '@rerms/config';
import Redis from 'ioredis';
import { API_ENVIRONMENT } from '../config/foundation-config.module';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor(@Inject(API_ENVIRONMENT) environment: ApiEnvironment) {
    this.client = new Redis(environment.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });
  }

  async ensureConnected(): Promise<void> {
    if (this.client.status === 'wait') await this.client.connect();
    await this.client.ping();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.status !== 'end') await this.client.quit();
  }
}
