import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DatabaseService } from '../database/database.service';
import { QueueService } from '../infrastructure/queue.service';
import { RedisService } from '../infrastructure/redis.service';

@ApiTags('foundation')
@Controller({ path: '', version: '1' })
export class HealthController {
  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
    private readonly queue: QueueService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Application liveness' })
  health(): { status: 'ok'; service: string } {
    return { status: 'ok', service: 'rerms-api' };
  }

  @Get('readiness')
  @ApiOperation({ summary: 'PostgreSQL, Redis, and queue readiness' })
  async readiness(): Promise<{ status: 'ready'; database: 'up'; redis: 'up'; queue: 'up' }> {
    await this.database.$queryRaw`SELECT 1`;
    await this.redis.ensureConnected();
    await this.queue.checkHealth();
    return { status: 'ready', database: 'up', redis: 'up', queue: 'up' };
  }
}
