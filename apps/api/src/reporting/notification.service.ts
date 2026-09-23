import { Injectable } from '@nestjs/common';
import { NotificationStatus } from '@prisma/client';
import { uuidv7 } from '@rerms/shared';
import { DatabaseService } from '../database/database.service';
import type { AuthenticatedPrincipal } from '../security/security.types';

@Injectable()
export class NotificationService {
  constructor(private readonly db: DatabaseService) {}

  async inbox(principal: AuthenticatedPrincipal, limit = 25) {
    const items = await this.db.notification.findMany({
      where: { userId: principal.userId, companyId: principal.companyId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        category: true,
        title: true,
        body: true,
        linkPath: true,
        entityType: true,
        entityId: true,
        status: true,
        readAt: true,
        createdAt: true,
      },
    });
    const now = new Date();
    const end = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const viewings = principal.employeeId
      ? await this.db.viewing.findMany({
          where: {
            companyId: principal.companyId,
            ...(principal.accessMode === 'COMPANY_WIDE'
              ? {}
              : { assignedEmployeeId: principal.employeeId }),
            scheduledAt: { gte: now, lt: end },
            status: { in: ['SCHEDULED', 'CONFIRMED'] },
          },
          orderBy: { scheduledAt: 'asc' },
          take: 10,
          select: {
            id: true,
            scheduledAt: true,
            lead: { select: { displayName: true } },
            rentableSpace: { select: { name: true, property: { select: { name: true } } } },
            saleListing: { select: { property: { select: { name: true } } } },
          },
        })
      : [];
    const company = await this.db.company.findUnique({
      where: { id: principal.companyId },
      select: { timezone: true },
    });
    const timezone = company?.timezone ?? 'Africa/Nairobi';
    const scheduleItems = viewings.map((viewing) => {
      const minutesUntil = Math.max(0, Math.round((viewing.scheduledAt.getTime() - now.getTime()) / 60000));
      const localParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(viewing.scheduledAt);
      const part = (type: Intl.DateTimeFormatPartTypes) => localParts.find((item) => item.type === type)?.value ?? '';
      const localDate = `${part('year')}-${part('month')}-${part('day')}`;
      const localTime = `${part('hour')}:${part('minute')}`;
      const dayLabel = localDate === principal.businessDate ? 'Today' : 'Tomorrow';
      const propertyName = viewing.rentableSpace?.property.name ?? viewing.saleListing?.property.name ?? 'Property';
      const reminder = minutesUntil <= 60;
      return {
        id: `viewing-schedule:${viewing.id}`,
        category: 'VIEWING',
        title: reminder
          ? minutesUntil === 0
            ? 'Viewing starts now'
            : `Viewing starts in ${minutesUntil} minute${minutesUntil === 1 ? '' : 's'}`
          : `${dayLabel}'s viewing scheduled`,
        body: `${viewing.lead.displayName} · ${propertyName} · ${localTime}`,
        linkPath: '/viewings',
        entityType: 'Viewing',
        entityId: viewing.id,
        status: reminder ? 'UNREAD' : 'READ',
        readAt: null,
        createdAt: viewing.scheduledAt,
      };
    });
    const combined = [...scheduleItems, ...items].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
    const reminderCount = scheduleItems.filter((item) => item.status === 'UNREAD').length;
    const unreadCount = await this.db.notification.count({
      where: { userId: principal.userId, companyId: principal.companyId, status: NotificationStatus.UNREAD },
    });
    return { items: combined, unreadCount: unreadCount + reminderCount };
  }

  async markRead(principal: AuthenticatedPrincipal, notificationId?: string) {
    if (notificationId?.startsWith('viewing-schedule:')) return { success: true as const };
    await this.db.notification.updateMany({
      where: notificationId
        ? { id: notificationId, userId: principal.userId, companyId: principal.companyId }
        : { userId: principal.userId, companyId: principal.companyId, status: NotificationStatus.UNREAD },
      data: { status: NotificationStatus.READ, readAt: new Date() },
    });
    return { success: true as const };
  }

  async notify(input: {
    companyId: string;
    userId: string;
    dedupeKey: string;
    category: string;
    title: string;
    body: string;
    linkPath?: string;
    entityType?: string;
    entityId?: string;
  }) {
    return this.db.notification.upsert({
      where: { userId_dedupeKey: { userId: input.userId, dedupeKey: input.dedupeKey } },
      update: {
        title: input.title,
        body: input.body,
        linkPath: input.linkPath ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
      },
      create: {
        id: uuidv7(),
        companyId: input.companyId,
        userId: input.userId,
        dedupeKey: input.dedupeKey,
        category: input.category,
        title: input.title,
        body: input.body,
        linkPath: input.linkPath ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
      },
    });
  }

  async seedOperationalNotifications(principal: AuthenticatedPrincipal) {
    if (principal.kind !== 'STAFF') return { created: 0 };
    const samples = [
      {
        dedupeKey: `follow-up:${principal.businessDate}`,
        category: 'FOLLOW_UP',
        title: 'Follow-up due today',
        body: 'Review CRM follow-ups assigned to your branch.',
        linkPath: '/crm/follow-ups',
      },
      {
        dedupeKey: `maintenance:${principal.businessDate}`,
        category: 'MAINTENANCE',
        title: 'Open maintenance requests',
        body: 'High-priority maintenance items need attention.',
        linkPath: '/operations/maintenance',
      },
      {
        dedupeKey: `payout:${principal.businessDate}`,
        category: 'FINANCE',
        title: 'Owner payouts pending review',
        body: 'Review owner payouts awaiting approval.',
        linkPath: '/finance/owner-payouts',
      },
    ];
    let created = 0;
    for (const sample of samples) {
      await this.notify({
        companyId: principal.companyId,
        userId: principal.userId,
        ...sample,
      });
      created += 1;
    }
    return { created };
  }
}
