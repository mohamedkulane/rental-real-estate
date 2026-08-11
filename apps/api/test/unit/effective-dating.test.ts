import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { BusinessDateService } from '../../src/common/business-date.service';
import { EffectiveDatingService } from '../../src/common/effective-dating.service';

describe('business date and effective-dating policy', () => {
  it('uses the company timezone at the UTC day boundary', () => {
    const instant = new Date('2026-08-10T22:30:00.000Z');
    expect(BusinessDateService.inTimezone('Africa/Nairobi', instant).toISOString()).toBe(
      '2026-08-11T00:00:00.000Z',
    );
    expect(BusinessDateService.inTimezone('UTC', instant).toISOString()).toBe(
      '2026-08-10T00:00:00.000Z',
    );
  });

  it('bounds corrections/scheduled changes and restricts lifecycle transitions to today', async () => {
    const businessDate = {
      today: vi.fn().mockResolvedValue(new Date('2026-08-11T00:00:00.000Z')),
    } as unknown as BusinessDateService;
    const service = new EffectiveDatingService(businessDate);
    await expect(service.scheduledDate('company', '2025-08-10')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.scheduledDate('company', '2027-08-12')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.lifecycleDate('company', '2026-08-12')).rejects.toThrow(
      'current company business date',
    );
    expect((await service.lifecycleDate('company', '2026-08-11')).toISOString()).toBe(
      '2026-08-11T00:00:00.000Z',
    );
  });

  it('requires a scheduled same-day/later interval to be cancelled before replacement', () => {
    const service = new EffectiveDatingService({} as BusinessDateService);
    expect(() =>
      service.assertNoLaterScheduledChange(new Date('2026-08-11'), [
        { effectiveFrom: new Date('2026-08-12') },
      ]),
    ).toThrow('Cancel it before adding a replacement');
    expect(() =>
      service.assertNoLaterScheduledChange(new Date('2026-08-11'), [
        { effectiveFrom: new Date('2026-08-10') },
      ]),
    ).not.toThrow();
  });
});
