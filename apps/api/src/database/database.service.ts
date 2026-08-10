import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@rerms/database';

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({
      transactionOptions: {
        maxWait: 15_000,
        timeout: 60_000,
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
