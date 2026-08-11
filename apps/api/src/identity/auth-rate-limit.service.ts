import { createHmac } from 'node:crypto';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import type { ApiEnvironment } from '@rerms/config';
import { API_ENVIRONMENT } from '../config/foundation-config.module';
import { RedisService } from '../infrastructure/redis.service';

@Injectable()
export class AuthRateLimitService {
  constructor(
    private readonly redis: RedisService,
    @Inject(API_ENVIRONMENT) private readonly environment: ApiEnvironment,
  ) {}

  private opaque(value: string): string {
    return createHmac('sha256', this.environment.AUTH_RATE_LIMIT_KEY)
      .update('auth-rate-limit:v1\0')
      .update(value.trim().toLowerCase())
      .digest('hex');
  }

  async consume(category: 'login' | 'reset', ipAddress: string, identity: string): Promise<void> {
    const windowSeconds = category === 'login' ? 15 * 60 : 60 * 60;
    const limit =
      category === 'login'
        ? this.environment.AUTH_LOGIN_LIMIT_PER_15_MINUTES
        : this.environment.AUTH_RESET_LIMIT_PER_HOUR;
    const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
    const key = `rerms:auth-limit:${category}:${bucket}:${this.opaque(`${ipAddress}|${identity}`)}`;
    const result = await this.redis.client
      .multi()
      .incr(key)
      .expire(key, windowSeconds + 60)
      .exec();
    const count = Number(result?.[0]?.[1] ?? 0);
    if (count > limit) throw new HttpException('Too many attempts. Please try again later.', 429);
  }
}
