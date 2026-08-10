import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { RedisService } from './redis.service';

@Injectable()
export class QueueService implements OnModuleDestroy {
  readonly foundationQueue: Queue;

  constructor(redis: RedisService) {
    this.foundationQueue = new Queue('foundation-infrastructure', {
      connection: redis.client,
      defaultJobOptions: { attempts: 3, removeOnComplete: 50, removeOnFail: 100 },
    });
  }

  async checkHealth(): Promise<void> {
    await this.foundationQueue.waitUntilReady();
  }

  async onModuleDestroy(): Promise<void> {
    await this.foundationQueue.close();
  }
}
