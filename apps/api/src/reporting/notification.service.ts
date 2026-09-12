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
    const unreadCount = await this.db.notification.count({
      where: { userId: principal.userId, companyId: principal.companyId, status: NotificationStatus.UNREAD },
    });
    return { items, unreadCount };
  }

  async markRead(principal: AuthenticatedPrincipal, notificationId?: string) {
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
