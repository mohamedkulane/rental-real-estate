import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';

export type TimelineEvent = {
  id: string;
  type: string;
  title: string;
  description: string;
  occurredAt: Date;
};

const readable = (value: string) => value.toLowerCase().replaceAll('_', ' ');

@Injectable()
export class ActivityTimelineService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auth: AuthorizationService,
  ) {}

  async get(principal: AuthenticatedPrincipal, entityType: string, entityId: string) {
    if (principal.kind !== 'STAFF') throw new ForbiddenException('Timeline access is staff-only.');
    const type = entityType.trim().toUpperCase();
    if (type === 'PROPERTY') return this.property(principal, entityId);
    if (type === 'CUSTOMER' || type === 'BUYER' || type === 'LEAD')
      return this.lead(principal, entityId);
    if (type === 'LEASE') return this.lease(principal, entityId);
    if (type === 'SALES_DEAL' || type === 'SALE_AGREEMENT')
      return this.saleAgreement(principal, entityId);
    throw new NotFoundException('Timeline context is not supported.');
  }

  private async property(principal: AuthenticatedPrincipal, id: string): Promise<TimelineEvent[]> {
    const property = await this.db.property.findFirst({
      where: { id, companyId: principal.companyId },
      select: {
        id: true,
        name: true,
        branchAssignments: {
          where: { effectiveTo: null },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
          select: { branchId: true },
        },
      },
    });
    if (!property) throw new NotFoundException('Property not found.');
    const branchId = property.branchAssignments[0]?.branchId;
    if (!branchId) throw new ForbiddenException('Property has no active branch scope.');
    this.auth.assertBranchPermission(principal, 'portfolio.property.read', branchId);
    const [history, viewings, maintenance] = await Promise.all([
      this.db.propertyLifecycleHistory.findMany({
        where: { propertyId: id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.db.viewing.findMany({
        where: { propertyId: id, companyId: principal.companyId },
        orderBy: { scheduledAt: 'desc' },
        take: 50,
        select: {
          id: true,
          scheduledAt: true,
          status: true,
          outcome: true,
          lead: { select: { displayName: true } },
        },
      }),
      this.db.maintenanceRequest.findMany({
        where: { propertyId: id, companyId: principal.companyId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, requestNumber: true, title: true, status: true, createdAt: true },
      }),
    ]);
    return [
      ...history.map((row) => ({
        id: 'property-status:' + row.id,
        type: 'PROPERTY_STATUS',
        title: 'Property status updated',
        description: property.name + ' is ' + readable(row.status) + '. ' + row.reason,
        occurredAt: row.createdAt,
      })),
      ...viewings.map((row) => ({
        id: 'viewing:' + row.id,
        type: 'VIEWING',
        title: row.status === 'COMPLETED' ? 'Viewing completed' : 'Viewing scheduled',
        description: row.lead.displayName + ' · ' + (row.outcome ?? readable(row.status)),
        occurredAt: row.scheduledAt,
      })),
      ...maintenance.map((row) => ({
        id: 'maintenance:' + row.id,
        type: 'MAINTENANCE',
        title: 'Maintenance opened',
        description: row.requestNumber + ' · ' + row.title + ' · ' + readable(row.status),
        occurredAt: row.createdAt,
      })),
    ]
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, 100);
  }

  private async lead(principal: AuthenticatedPrincipal, id: string): Promise<TimelineEvent[]> {
    const lead = await this.db.lead.findFirst({
      where: { id, companyId: principal.companyId },
      select: { id: true, displayName: true, responsibleBranchId: true },
    });
    if (!lead) throw new NotFoundException('Customer or buyer not found.');
    this.auth.assertBranchPermission(principal, 'crm.lead.read', lead.responsibleBranchId);
    const [activities, followUps, viewings] = await Promise.all([
      this.db.leadActivity.findMany({
        where: { leadId: id },
        orderBy: { occurredAt: 'desc' },
        take: 50,
        select: { id: true, type: true, summary: true, occurredAt: true },
      }),
      this.db.leadFollowUpOutcome.findMany({
        where: { followUp: { leadId: id } },
        orderBy: { occurredAt: 'desc' },
        take: 50,
        select: { id: true, toState: true, reason: true, occurredAt: true },
      }),
      this.db.viewing.findMany({
        where: { leadId: id },
        orderBy: { scheduledAt: 'desc' },
        take: 50,
        select: { id: true, scheduledAt: true, status: true, outcome: true },
      }),
    ]);
    return [
      ...activities.map((row) => ({
        id: 'lead-activity:' + row.id,
        type: 'ACTIVITY',
        title: 'Customer activity recorded',
        description: readable(row.type) + ' · ' + row.summary,
        occurredAt: row.occurredAt,
      })),
      ...followUps.map((row) => ({
        id: 'follow-up:' + row.id,
        type: 'FOLLOW_UP',
        title: 'Follow-up updated',
        description: readable(row.toState) + ' · ' + row.reason,
        occurredAt: row.occurredAt,
      })),
      ...viewings.map((row) => ({
        id: 'viewing:' + row.id,
        type: 'VIEWING',
        title: row.status === 'COMPLETED' ? 'Viewing completed' : 'Viewing scheduled',
        description: row.outcome ?? readable(row.status),
        occurredAt: row.scheduledAt,
      })),
    ]
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, 100);
  }

  private async lease(principal: AuthenticatedPrincipal, id: string): Promise<TimelineEvent[]> {
    const lease = await this.db.lease.findFirst({
      where: { id, companyId: principal.companyId },
      select: {
        id: true,
        leaseNumber: true,
        branchId: true,
        status: true,
        createdAt: true,
        versions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: { id: true, sequence: true, signedAt: true, createdAt: true },
        },
        possessions: {
          orderBy: { possessionFrom: 'desc' },
          take: 50,
          select: { id: true, status: true, possessionFrom: true, possessionTo: true },
        },
      },
    });
    if (!lease) throw new NotFoundException('Lease not found.');
    this.auth.assertBranchPermission(principal, 'lease.read', lease.branchId);
    const [payments, agreement] = await Promise.all([
      this.db.paymentAllocation.findMany({
        where: {
          reversedAt: null,
          charge: { leaseId: id },
          payment: { companyId: principal.companyId },
        },
        orderBy: { allocatedAt: 'desc' },
        take: 50,
        select: {
          id: true,
          amount: true,
          allocatedAt: true,
          payment: { select: { currency: true, paymentNumber: true } },
        },
      }),
      this.db.rentalAgreement.findFirst({
        where: { lease: { id } },
        select: { id: true, agreementNumber: true, confirmedAt: true, createdAt: true },
      }),
    ]);
    return [
      {
        id: 'lease:created:' + lease.id,
        type: 'LEASE',
        title: 'Lease created',
        description: lease.leaseNumber + ' · ' + readable(lease.status),
        occurredAt: lease.createdAt,
      },
      ...lease.versions.map((row) => ({
        id: 'lease-version:' + row.id,
        type: 'AGREEMENT',
        title: row.signedAt ? 'Agreement signed' : 'Lease terms saved',
        description: lease.leaseNumber + ' · version ' + row.sequence,
        occurredAt: row.signedAt ?? row.createdAt,
      })),
      ...(agreement
        ? [
            {
              id: 'agreement:' + agreement.id,
              type: 'AGREEMENT',
              title: 'Agreement confirmed',
              description: agreement.agreementNumber,
              occurredAt: agreement.confirmedAt ?? agreement.createdAt,
            },
          ]
        : []),
      ...lease.possessions.map((row) => ({
        id: 'possession:' + row.id,
        type: row.status === 'ENDED' ? 'MOVE_OUT' : 'MOVE_IN',
        title: row.status === 'ENDED' ? 'Move-Out completed' : 'Move-In recorded',
        description: lease.leaseNumber,
        occurredAt: row.possessionTo ?? row.possessionFrom,
      })),
      ...payments.map((row) => ({
        id: 'payment:' + row.id,
        type: 'PAYMENT',
        title: 'Payment received',
        description:
          row.payment.paymentNumber + ' · ' + row.payment.currency + ' ' + row.amount.toString(),
        occurredAt: row.allocatedAt,
      })),
    ]
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, 100);
  }

  private async saleAgreement(
    principal: AuthenticatedPrincipal,
    id: string,
  ): Promise<TimelineEvent[]> {
    const agreement = await this.db.saleAgreement.findFirst({
      where: { id, companyId: principal.companyId },
      select: {
        id: true,
        agreementNumber: true,
        branchId: true,
        status: true,
        createdAt: true,
        confirmedAt: true,
        cancelledAt: true,
        saleOffer: {
          select: {
            id: true,
            events: {
              orderBy: { occurredAt: 'desc' },
              take: 50,
              select: { id: true, eventType: true, notes: true, occurredAt: true },
            },
          },
        },
      },
    });
    if (!agreement) throw new NotFoundException('Sale Agreement not found.');
    this.auth.assertBranchPermission(principal, 'sale-offer.read', agreement.branchId);
    return [
      {
        id: 'sale-agreement:created:' + agreement.id,
        type: 'AGREEMENT',
        title: 'Sale agreement created',
        description: agreement.agreementNumber + ' · ' + readable(agreement.status),
        occurredAt: agreement.createdAt,
      },
      ...(agreement.confirmedAt
        ? [
            {
              id: 'sale-agreement:confirmed:' + agreement.id,
              type: 'AGREEMENT',
              title: 'Agreement confirmed',
              description: agreement.agreementNumber,
              occurredAt: agreement.confirmedAt,
            },
          ]
        : []),
      ...(agreement.cancelledAt
        ? [
            {
              id: 'sale-agreement:cancelled:' + agreement.id,
              type: 'AGREEMENT',
              title: 'Agreement cancelled',
              description: agreement.agreementNumber,
              occurredAt: agreement.cancelledAt,
            },
          ]
        : []),
      ...(agreement.saleOffer?.events ?? []).map((row) => ({
        id: 'sale-offer-event:' + row.id,
        type: 'SALES',
        title: 'Sales deal updated',
        description: readable(row.eventType) + (row.notes ? ' · ' + row.notes : ''),
        occurredAt: row.occurredAt,
      })),
    ]
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, 100);
  }
}
