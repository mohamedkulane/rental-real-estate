import { BadRequestException, Injectable } from '@nestjs/common';
import { BusinessDateService } from './business-date.service';

@Injectable()
export class EffectiveDatingService {
  constructor(private readonly businessDate: BusinessDateService) {}

  async scheduledDate(companyId: string, isoDate: string): Promise<Date> {
    const effectiveDate = new Date(`${isoDate.slice(0, 10)}T00:00:00.000Z`);
    if (Number.isNaN(effectiveDate.getTime()))
      throw new BadRequestException('Effective date is invalid.');
    const today = await this.businessDate.today(companyId);
    const earliest = new Date(today);
    earliest.setUTCFullYear(earliest.getUTCFullYear() - 1);
    if (effectiveDate < earliest)
      throw new BadRequestException(
        'An effective correction cannot be backdated more than one year.',
      );
    const latest = new Date(today);
    latest.setUTCFullYear(latest.getUTCFullYear() + 1);
    if (effectiveDate > latest)
      throw new BadRequestException(
        'An effective change cannot be scheduled more than one year ahead.',
      );
    return effectiveDate;
  }

  async lifecycleDate(companyId: string, isoDate?: string): Promise<Date> {
    const today = await this.businessDate.today(companyId);
    if (!isoDate) return today;
    const effectiveDate = await this.scheduledDate(companyId, isoDate);
    if (effectiveDate.getTime() !== today.getTime())
      throw new BadRequestException(
        'Property lifecycle transitions must take effect on the current company business date.',
      );
    return effectiveDate;
  }

  assertNoLaterScheduledChange(
    effectiveDate: Date,
    rows: ReadonlyArray<{ effectiveFrom: Date }>,
  ): void {
    if (rows.some((row) => row.effectiveFrom >= effectiveDate))
      throw new BadRequestException(
        'A same-day or later scheduled change already exists. Cancel it before adding a replacement.',
      );
  }
}
