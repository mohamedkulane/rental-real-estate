import { Injectable } from '@nestjs/common';
import { NotificationStatus } from '@prisma/client';
import { uuidv7 } from '@rerms/shared';
import { DatabaseService } from '../database/database.service';
import type { AuthenticatedPrincipal } from '../security/security.types';

@Injectable()
export class NotificationService {
  constructor(private readonly db: DatabaseService) {}

  async inbox(principal: AuthenticatedPrincipal, limit = 25) {
    await this.generateOperationalNotifications(principal);
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
      const minutesUntil = Math.max(
        0,
        Math.round((viewing.scheduledAt.getTime() - now.getTime()) / 60000),
      );
      const localParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(viewing.scheduledAt);
      const part = (type: Intl.DateTimeFormatPartTypes) =>
        localParts.find((item) => item.type === type)?.value ?? '';
      const localDate = `${part('year')}-${part('month')}-${part('day')}`;
      const localTime = `${part('hour')}:${part('minute')}`;
      const dayLabel = localDate === principal.businessDate ? 'Today' : 'Tomorrow';
      const propertyName =
        viewing.rentableSpace?.property.name ?? viewing.saleListing?.property.name ?? 'Property';
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
    const combined = [...scheduleItems, ...items]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
    const reminderCount = scheduleItems.filter((item) => item.status === 'UNREAD').length;
    const unreadCount = await this.db.notification.count({
      where: {
        userId: principal.userId,
        companyId: principal.companyId,
        status: NotificationStatus.UNREAD,
      },
    });
    return { items: combined, unreadCount: unreadCount + reminderCount };
  }

  async markRead(principal: AuthenticatedPrincipal, notificationId?: string) {
    if (notificationId?.startsWith('viewing-schedule:')) return { success: true as const };
    await this.db.notification.updateMany({
      where: notificationId
        ? { id: notificationId, userId: principal.userId, companyId: principal.companyId }
        : {
            userId: principal.userId,
            companyId: principal.companyId,
            status: NotificationStatus.UNREAD,
          },
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
    return { created: await this.generateOperationalNotifications(principal) };
  }

  async generateOperationalNotifications(principal: AuthenticatedPrincipal) {
    if (principal.kind !== 'STAFF') return 0;
    const branchFilter =
      principal.accessMode === 'COMPANY_WIDE' ? {} : { branchId: { in: [...principal.branchIds] } };
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const inFortyFiveDays = new Date(now);
    inFortyFiveDays.setDate(inFortyFiveDays.getDate() + 45);
    let generated = 0;
    const add = async (input: Parameters<NotificationService['notify']>[0]) => {
      await this.notify(input);
      generated += 1;
    };

    const viewingRows = await this.db.viewing.findMany({
      where: {
        companyId: principal.companyId,
        ...(principal.accessMode === 'COMPANY_WIDE' ? {} : branchFilter),
        ...(principal.employeeId && principal.accessMode !== 'COMPANY_WIDE'
          ? { assignedEmployeeId: principal.employeeId }
          : {}),
        scheduledAt: { gte: now, lte: new Date(now.getTime() + 48 * 60 * 60 * 1000) },
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
      },
      take: 50,
      select: { id: true, scheduledAt: true, lead: { select: { displayName: true } } },
    });
    for (const row of viewingRows) {
      await add({
        companyId: principal.companyId,
        userId: principal.userId,
        dedupeKey: `viewing:${row.id}:${row.scheduledAt.toISOString()}`,
        category: 'VIEWING',
        title: 'Viewing scheduled soon',
        body: `${row.lead.displayName} · ${row.scheduledAt.toLocaleString()}`,
        linkPath: '/viewings',
        entityType: 'Viewing',
        entityId: row.id,
      });
    }

    const followUps = await this.db.leadFollowUp.findMany({
      where: {
        lead: { companyId: principal.companyId },
        ...(principal.accessMode === 'COMPANY_WIDE' ? {} : branchFilter),
        ...(principal.employeeId ? { responsibleEmployeeId: principal.employeeId } : {}),
        state: 'OPEN',
        dueAt: { lte: tomorrow },
      },
      take: 50,
      select: {
        id: true,
        dueAt: true,
        subject: true,
        leadId: true,
        lead: { select: { displayName: true } },
      },
    });
    for (const row of followUps) {
      await add({
        companyId: principal.companyId,
        userId: principal.userId,
        dedupeKey: `follow-up:${row.id}:${row.dueAt.toISOString().slice(0, 10)}`,
        category: 'FOLLOW_UP',
        title: 'Follow-up due',
        body: `${row.lead.displayName} · ${row.subject}`,
        linkPath: '/crm/follow-ups',
        entityType: 'LeadFollowUp',
        entityId: row.id,
      });
    }

    if (principal.permissions.has('payment.read')) {
      const charges = await this.db.charge.findMany({
        where: {
          companyId: principal.companyId,
          ...branchFilter,
          outstandingAmount: { gt: 0 },
          dueDate: { lte: tomorrow },
        },
        take: 50,
        select: {
          id: true,
          chargeNumber: true,
          dueDate: true,
          outstandingAmount: true,
          currency: true,
          debtor: { select: { displayName: true } },
        },
      });
      for (const row of charges) {
        const overdue = row.dueDate < new Date(principal.businessDate + 'T00:00:00.000Z');
        await add({
          companyId: principal.companyId,
          userId: principal.userId,
          dedupeKey: `charge:${row.id}:${overdue ? 'overdue' : row.dueDate.toISOString().slice(0, 10)}`,
          category: 'FINANCE',
          title: overdue ? 'Rent overdue' : 'Rent due soon',
          body: `${row.debtor.displayName} · ${row.currency} ${row.outstandingAmount.toString()} · ${row.chargeNumber}`,
          linkPath: '/finance/payments',
          entityType: 'Charge',
          entityId: row.id,
        });
      }
    }

    if (principal.permissions.has('lease.read')) {
      const leases = await this.db.lease.findMany({
        where: {
          companyId: principal.companyId,
          ...branchFilter,
          status: { in: ['SIGNED', 'ACTIVE'] },
          leaseEndDate: { not: null, gte: now, lte: inFortyFiveDays },
        },
        take: 50,
        select: { id: true, leaseNumber: true, leaseEndDate: true },
      });
      for (const row of leases) {
        await add({
          companyId: principal.companyId,
          userId: principal.userId,
          dedupeKey: `lease-ending:${row.id}:${row.leaseEndDate!.toISOString().slice(0, 10)}`,
          category: 'LEASE',
          title: 'Lease ending soon',
          body: `${row.leaseNumber} · ends ${row.leaseEndDate!.toISOString().slice(0, 10)}`,
          linkPath: `/leasing/leases/${row.id}`,
          entityType: 'Lease',
          entityId: row.id,
        });
      }
    }

    if (principal.permissions.has('payout.read')) {
      const payouts = await this.db.ownerPayout.findMany({
        where: { companyId: principal.companyId, ...branchFilter, status: 'REVIEW' },
        take: 50,
        select: { id: true, payoutNumber: true, owner: { select: { displayName: true } } },
      });
      for (const row of payouts) {
        await add({
          companyId: principal.companyId,
          userId: principal.userId,
          dedupeKey: `payout-review:${row.id}`,
          category: 'FINANCE',
          title: 'Owner payout awaiting review',
          body: `${row.payoutNumber} · ${row.owner.displayName}`,
          linkPath: `/finance/owner-payouts/${row.id}`,
          entityType: 'OwnerPayout',
          entityId: row.id,
        });
      }
    }

    if (principal.permissions.has('maintenance.read')) {
      const requests = await this.db.maintenanceRequest.findMany({
        where: {
          companyId: principal.companyId,
          ...branchFilter,
          priority: { in: ['URGENT', 'HIGH'] },
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
        take: 50,
        select: { id: true, requestNumber: true, title: true, priority: true },
      });
      for (const row of requests) {
        await add({
          companyId: principal.companyId,
          userId: principal.userId,
          dedupeKey: `maintenance-priority:${row.id}`,
          category: 'MAINTENANCE',
          title: 'High-priority maintenance needs attention',
          body: `${row.requestNumber} · ${row.priority.toLowerCase()} · ${row.title}`,
          linkPath: `/operations/maintenance/${row.id}`,
          entityType: 'MaintenanceRequest',
          entityId: row.id,
        });
      }
    }
    return generated;
  }
}
