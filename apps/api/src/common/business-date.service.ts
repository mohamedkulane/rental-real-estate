import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class BusinessDateService {
  constructor(private readonly database: DatabaseService) {}

  static inTimezone(timezone: string, instant = new Date()): Date {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(instant);
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return new Date(`${value.year}-${value.month}-${value.day}T00:00:00.000Z`);
  }

  async today(companyId: string, instant = new Date()): Promise<Date> {
    const company = await this.database.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { timezone: true },
    });
    return BusinessDateService.inTimezone(company.timezone, instant);
  }
}
