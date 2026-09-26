import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ApplicationStatus,
  LeasePartyRole,
  LeasePossessionStatus,
  LeaseStatus,
  ListingStatus,
  MoveInStatus,
  Prisma,
  PropertyStatus,
  RenewalStatus,
  RentableSpaceStatus,
  ReservationStatus,
  ScreeningStatus,
  ServiceEngagementStatus,
  ServiceModel,
  TenantStatus,
  ViewingStatus,
} from '@prisma/client';
import { uuidv7 } from '@rerms/shared';
import { resolveCapabilitySet } from '../commercial/service-engagement.policy';
import { nextRecordNumber } from '../common/record-number';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../governance/audit.service';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';
import { WorkflowPayloadCipher } from '../workflow/workflow-payload-cipher';
import { assertHierarchyOccupancyAvailable } from './space-hierarchy-occupancy';
import {
  ACTIVE_RESIDENTIAL_TENANCY_MESSAGE,
  assertActiveResidentialTenancyAvailable,
  isActiveResidentialTenancyConstraint,
} from './active-tenancy';
import type {
  ApplicationQueryDto,
  ApplicationTransitionDto,
  CompleteViewingDto,
  ConvertTenantDto,
  CreateApplicationDto,
  CreateLeaseDto,
  CreateRenewalDto,
  CreateReservationDto,
  CreateViewingDto,
  LeaseQueryDto,
  LeaseTransitionDto,
  MoveOutDto,
  MoveInQueryDto,
  MoveInTransitionDto,
  RecordScreeningDto,
  RenewalQueryDto,
  RenewalTransitionDto,
  ReservationQueryDto,
  ReservationTransitionDto,
  RescheduleViewingDto,
  ScheduleMoveInDto,
  TenantQueryDto,
  ViewingQueryDto,
} from './phase5-operations.dto';
import {
  assertDistinctLeaseParties,
  assertPartiesNotPropertyOwners,
} from './leasing.policy';

export const applicationTransitions: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  DRAFT: [ApplicationStatus.SUBMITTED, ApplicationStatus.WITHDRAWN],
  SUBMITTED: [ApplicationStatus.UNDER_REVIEW, ApplicationStatus.WITHDRAWN],
  UNDER_REVIEW: [ApplicationStatus.APPROVED, ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN],
  APPROVED: [], REJECTED: [], WITHDRAWN: [],
};
export const leaseTransitions: Record<LeaseStatus, readonly LeaseStatus[]> = {
  DRAFT: [LeaseStatus.PENDING_APPROVAL],
  PENDING_APPROVAL: [LeaseStatus.ACTIVE, LeaseStatus.DRAFT],
  // Legacy escape paths for in-flight leases created before the simplified workflow.
  APPROVED: [LeaseStatus.ACTIVE],
  PENDING_SIGNATURE: [LeaseStatus.SIGNED, LeaseStatus.ACTIVE],
  SIGNED: [LeaseStatus.ACTIVE, LeaseStatus.TERMINATED],
  ACTIVE: [LeaseStatus.ENDED, LeaseStatus.TERMINATED],
  ENDED: [LeaseStatus.ARCHIVED],
  TERMINATED: [LeaseStatus.ARCHIVED],
  ARCHIVED: [],
};
export const renewalTransitions: Record<RenewalStatus, readonly RenewalStatus[]> = {
  DRAFT: [RenewalStatus.PROPOSED, RenewalStatus.CANCELLED],
  PROPOSED: [RenewalStatus.APPROVED, RenewalStatus.REJECTED, RenewalStatus.CANCELLED],
  APPROVED: [RenewalStatus.SIGNED, RenewalStatus.REJECTED],
  SIGNED: [RenewalStatus.ACTIVATED],
  ACTIVATED: [], REJECTED: [], CANCELLED: [],
};

function oneOf<T>(value: T, allowed: readonly T[]): boolean {
  return allowed.includes(value);
}

function isDatabaseConcurrencyConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError
    && ['P2002', 'P2004', 'P2034'].includes(error.code);
}

@Injectable()
export class LeasingService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auth: AuthorizationService,
    private readonly audit: AuditService,
    private readonly cipher: WorkflowPayloadCipher,
  ) {}

  private branches(principal: AuthenticatedPrincipal, permission: string, branchId?: string) {
    const allowed = this.auth.authorizedBranchIds(principal, permission);
    if (allowed === null) return branchId ? [branchId] : null;
    return [...allowed].filter((id) => !branchId || id === branchId);
  }

  private page<T extends { id: string }>(rows: T[], limit: number) {
    const hasNextPage = rows.length > limit;
    const items = rows.slice(0, limit);
    return { items, pageInfo: { hasNextPage, nextCursor: hasNextPage ? items.at(-1)?.id ?? null : null } };
  }

  private async activeEngagement(principal: AuthenticatedPrincipal, engagementId: string, propertyId: string, rentableSpaceId?: string) {
    const at = new Date(`${principal.businessDate}T00:00:00.000Z`);
    const engagement = await this.db.serviceEngagement.findFirst({ where: {
      id: engagementId, companyId: principal.companyId, propertyId,
      status: ServiceEngagementStatus.ACTIVE, effectiveFrom: { lte: at },
      AND: [
        { OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }] },
        rentableSpaceId ? { OR: [{ rentableSpaceId: null }, { rentableSpaceId }] } : { rentableSpaceId: null },
      ],
    } });
    if (!engagement) throw new ConflictException('An active compatible Service Engagement is required.');
    return engagement;
  }

  private capabilities(engagement: { serviceModel: Parameters<typeof resolveCapabilitySet>[0][number]; rentableSpaceId: string | null }) {
    return resolveCapabilitySet(engagement.rentableSpaceId ? [] : [engagement.serviceModel], engagement.rentableSpaceId ? [engagement.serviceModel] : []);
  }

  private ownershipAsOf(principal: AuthenticatedPrincipal) {
    return new Date(`${principal.businessDate}T00:00:00.000Z`);
  }

  private async assertApplicantNotSelfRenting(propertyId: string, applicantPartyId: string | null | undefined, principal: AuthenticatedPrincipal) {
    if (!applicantPartyId) return;
    await assertPartiesNotPropertyOwners(this.db.propertyOwnership, propertyId, [applicantPartyId], this.ownershipAsOf(principal));
  }

  async listViewings(principal: AuthenticatedPrincipal, query: ViewingQueryDto) {
    const branchIds = this.branches(principal, 'viewing.read', query.branchId);
    const where: Prisma.ViewingWhereInput = {
      companyId: principal.companyId, ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
      ...(query.status ? { status: query.status } : {}), ...(query.leadId ? { leadId: query.leadId } : {}),
      ...(query.cursor ? { id: { lt: query.cursor } } : {}),
      ...(query.search ? { OR: [
        { lead: { is: { displayName: { contains: query.search, mode: 'insensitive' } } } },
        { lead: { is: { leadNumber: { contains: query.search, mode: 'insensitive' } } } },
        { rentalListing: { is: { title: { contains: query.search, mode: 'insensitive' } } } },
        { saleListing: { is: { title: { contains: query.search, mode: 'insensitive' } } } },
      ] } : {}),
    };
    const rows = await this.db.viewing.findMany({ where, orderBy: { id: 'desc' }, take: query.limit + 1, include: { lead: { select: { id: true, leadNumber: true, displayName: true, intent: true } }, rentalListing: { select: { id: true, listingNumber: true, title: true, rentableSpaceId: true } }, saleListing: { select: { id: true, listingNumber: true, title: true } }, property: { select: { id: true, propertyCode: true, name: true } }, rentableSpace: { select: { id: true, spaceCode: true, name: true, propertyId: true } }, assignedEmployee: { select: { id: true, employeeNumber: true, party: { select: { displayName: true } } } } } });
    return this.page(rows, query.limit);
  }

  async createViewing(principal: AuthenticatedPrincipal, input: CreateViewingDto, correlationId?: string) {
    const targetCount = [input.rentalListingId, input.saleListingId, input.propertyId, input.rentableSpaceId].filter(Boolean).length;
    if (targetCount !== 1) {
      throw new BadRequestException('Choose exactly one rental listing, sale listing, property, or rentable space.');
    }
    const lead = await this.db.lead.findFirst({ where: { id: input.leadId, companyId: principal.companyId } });
    if (!lead) throw new NotFoundException('Lead not found.');
    this.auth.assertBranchPermission(principal, 'viewing.create', lead.responsibleBranchId);

    let rentalListingId: string | null = input.rentalListingId ?? null;
    let saleListingId: string | null = input.saleListingId ?? null;
    let propertyId: string | null = input.propertyId ?? null;
    let rentableSpaceId: string | null = input.rentableSpaceId ?? null;

    if (input.rentableSpaceId) {
      const at = new Date(`${principal.businessDate}T00:00:00.000Z`);
      const space = await this.db.rentableSpace.findFirst({
        where: {
          id: input.rentableSpaceId,
          status: RentableSpaceStatus.ACTIVE,
          property: {
            companyId: principal.companyId,
            status: PropertyStatus.ACTIVE,
            branchAssignments: {
              some: {
                branchId: lead.responsibleBranchId,
                effectiveFrom: { lte: at },
                OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
              },
            },
          },
        },
        select: { id: true },
      });
      if (!space) {
        throw new ConflictException('The selected rentable space is unavailable in the customer branch.');
      }
      rentableSpaceId = space.id;
    } else if (input.propertyId) {
      const at = new Date(`${principal.businessDate}T00:00:00.000Z`);
      const property = await this.db.property.findFirst({
        where: {
          id: input.propertyId,
          companyId: principal.companyId,
          status: PropertyStatus.ACTIVE,
          serviceIntent: 'SALE',
          branchAssignments: { some: { branchId: lead.responsibleBranchId, effectiveFrom: { lte: at }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }] } },
          serviceEngagements: { some: { status: ServiceEngagementStatus.ACTIVE, serviceModel: { in: [ServiceModel.SALE_BROKERAGE, ServiceModel.COMPANY_OWNED] }, effectiveFrom: { lte: at }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }] } },
          saleSettlements: { none: { status: 'SETTLED' } },
          saleOffers: { none: { status: 'ACCEPTED' } },
        },
        select: { id: true },
      });
      if (!property) throw new ConflictException('The selected sale property is unavailable.');
      propertyId = property.id;
    } else if (input.rentalListingId) {
      const listing = await this.db.rentalListing.findFirst({
        where: {
          id: input.rentalListingId,
          companyId: principal.companyId,
          branchId: lead.responsibleBranchId,
          status: ListingStatus.PUBLISHED,
        },
        include: { serviceEngagement: true },
      });
      if (!listing) throw new ConflictException('The selected published Listing is unavailable in the Lead branch.');
      if (!this.capabilities(listing.serviceEngagement).canCreateViewing) {
        throw new ConflictException('The Service Engagement does not permit Viewings.');
      }
      rentalListingId = listing.id;
      rentableSpaceId = listing.rentableSpaceId;
    } else {
      const listing = await this.db.saleListing.findFirst({
        where: {
          id: input.saleListingId!,
          companyId: principal.companyId,
          branchId: lead.responsibleBranchId,
          status: ListingStatus.PUBLISHED,
        },
        include: { serviceEngagement: true },
      });
      if (!listing) throw new ConflictException('The selected published Listing is unavailable in the Lead branch.');
      if (!this.capabilities(listing.serviceEngagement).canCreateViewing) {
        throw new ConflictException('The Service Engagement does not permit Viewings.');
      }
      saleListingId = listing.id;
    }

    const scheduledAt = new Date(input.scheduledAt);
    const at = new Date(`${principal.businessDate}T00:00:00.000Z`);
    if (scheduledAt <= at) throw new BadRequestException('Viewing time must be after the current Business Date.');
    const employee = await this.db.employee.findFirst({
      where: {
        id: input.assignedEmployeeId,
        companyId: principal.companyId,
        active: true,
        branchAssignments: {
          some: {
            branchId: lead.responsibleBranchId,
            effectiveFrom: { lte: at },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
          },
        },
      },
      select: { id: true },
    });
    if (!employee) {
      throw new ConflictException(
        'The assigned agent is not available in this customer branch. Choose an agent assigned to the branch.',
      );
    }
    const row = await this.db.$transaction(async (tx) => {
      const created = await tx.viewing.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          branchId: lead.responsibleBranchId,
          leadId: lead.id,
          rentalListingId,
          saleListingId,
          propertyId,
          rentableSpaceId,
          assignedEmployeeId: employee.id,
          scheduledAt,
          notes: input.notes?.trim() || null,
          createdByUserId: principal.userId,
        },
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'viewing.scheduled',
        entityType: 'Viewing',
        entityId: created.id,
        branchId: created.branchId,
        correlationId,
        after: {
          leadId: created.leadId,
          scheduledAt: created.scheduledAt,
          rentableSpaceId: created.rentableSpaceId,
        },
      });
      return created;
    });
    return row;
  }

  async rescheduleViewing(principal: AuthenticatedPrincipal, id: string, input: RescheduleViewingDto, correlationId?: string) {
    const current = await this.db.viewing.findFirst({ where: { id, companyId: principal.companyId } });
    if (!current) throw new NotFoundException('Viewing not found.');
    this.auth.assertBranchPermission(principal, 'viewing.update', current.branchId);
    if (!oneOf(current.status, [ViewingStatus.SCHEDULED, ViewingStatus.CONFIRMED])) throw new ConflictException('Only an open Viewing can be rescheduled.');
    return this.db.$transaction(async (tx) => {
      const changed = await tx.viewing.updateMany({ where: { id, version: input.expectedVersion, status: current.status }, data: { scheduledAt: new Date(input.scheduledAt), status: ViewingStatus.SCHEDULED, version: { increment: 1 } } });
      if (changed.count !== 1) throw new ConflictException('Viewing is stale or has already changed.');
      const row = await tx.viewing.findUniqueOrThrow({ where: { id } });
      await this.audit.write(tx, { actorUserId: principal.userId, action: 'viewing.rescheduled', entityType: 'Viewing', entityId: id, branchId: current.branchId, correlationId, reason: input.reason, before: { scheduledAt: current.scheduledAt, version: current.version }, after: { scheduledAt: row.scheduledAt, version: row.version } });
      return row;
    });
  }

  async completeViewing(principal: AuthenticatedPrincipal, id: string, input: CompleteViewingDto, correlationId?: string) {
    if (!oneOf(input.status, [ViewingStatus.CONFIRMED, ViewingStatus.COMPLETED, ViewingStatus.CANCELLED, ViewingStatus.NO_SHOW])) throw new BadRequestException('Unsupported Viewing transition.');
    const current = await this.db.viewing.findFirst({ where: { id, companyId: principal.companyId } });
    if (!current) throw new NotFoundException('Viewing not found.');
    this.auth.assertBranchPermission(principal, 'viewing.complete', current.branchId);
    const allowed = current.status === ViewingStatus.SCHEDULED ? [ViewingStatus.CONFIRMED, ViewingStatus.CANCELLED, ViewingStatus.NO_SHOW] : current.status === ViewingStatus.CONFIRMED ? [ViewingStatus.COMPLETED, ViewingStatus.CANCELLED, ViewingStatus.NO_SHOW] : [];
    if (!oneOf<ViewingStatus>(input.status, allowed)) throw new ConflictException(`Viewing cannot transition from ${current.status} to ${input.status}.`);
    return this.db.$transaction(async (tx) => {
      const changed = await tx.viewing.updateMany({ where: { id, version: input.expectedVersion, status: current.status }, data: { status: input.status, outcome: input.outcome?.trim() || null, version: { increment: 1 } } });
      if (changed.count !== 1) throw new ConflictException('Viewing is stale or has already changed.');
      const row = await tx.viewing.findUniqueOrThrow({ where: { id } });
      await this.audit.write(tx, { actorUserId: principal.userId, action: 'viewing.transitioned', entityType: 'Viewing', entityId: id, branchId: current.branchId, correlationId, reason: input.reason, before: { status: current.status }, after: { status: row.status } });
      return row;
    });
  }

  async listApplications(principal: AuthenticatedPrincipal, query: ApplicationQueryDto) {
    const branchIds = this.branches(principal, 'application.read', query.branchId);
    const where: Prisma.RentalApplicationWhereInput = { companyId: principal.companyId, ...(branchIds === null ? {} : { branchId: { in: branchIds } }), ...(query.status ? { status: query.status } : {}), ...(query.screeningStatus ? { screeningStatus: query.screeningStatus } : {}), ...(query.leadId ? { leadId: query.leadId } : {}), ...(query.cursor ? { id: { lt: query.cursor } } : {}), ...(query.search ? { OR: [{ applicationNumber: { contains: query.search, mode: 'insensitive' } }, { lead: { is: { displayName: { contains: query.search, mode: 'insensitive' } } } }, { rentalListing: { is: { title: { contains: query.search, mode: 'insensitive' } } } }] } : {}) };
    const rows = await this.db.rentalApplication.findMany({ where, orderBy: { id: 'desc' }, take: query.limit + 1, select: { id: true, applicationNumber: true, status: true, screeningStatus: true, version: true, submittedAt: true, decidedAt: true, createdAt: true, branchId: true, lead: { select: { id: true, leadNumber: true, displayName: true } }, rentalListing: { select: { id: true, listingNumber: true, title: true, serviceEngagementId: true, rentableSpace: { select: { id: true, spaceCode: true, name: true, propertyId: true } } } }, applicantParty: { select: { id: true, displayName: true } } } });
    return this.page(rows, query.limit);
  }

  async createApplication(principal: AuthenticatedPrincipal, input: CreateApplicationDto, correlationId?: string) {
    const listing = await this.db.rentalListing.findFirst({ where: { id: input.rentalListingId, companyId: principal.companyId, status: ListingStatus.PUBLISHED }, include: { serviceEngagement: true } });
    if (!listing) throw new NotFoundException('Published Rental Listing not found.');
    this.auth.assertBranchPermission(principal, 'application.create', listing.branchId);
    if (!this.capabilities(listing.serviceEngagement).canAcceptApplication) throw new ConflictException('The Service Engagement does not permit Applications.');
    const lead = await this.db.lead.findFirst({ where: { id: input.leadId, companyId: principal.companyId, responsibleBranchId: listing.branchId, intent: 'RENT' } });
    if (!lead) throw new ConflictException('A Rent Lead in the Listing branch is required.');
    if (input.applicantPartyId) {
      const party = await this.db.party.findFirst({ where: { id: input.applicantPartyId, companyId: principal.companyId } });
      if (!party) throw new ConflictException('Applicant Party is unavailable.');
    }
    const applicantPartyId = input.applicantPartyId ?? lead.partyId;
    const space = await this.db.rentableSpace.findFirst({
      where: { id: listing.rentableSpaceId, property: { companyId: principal.companyId } },
      select: { propertyId: true },
    });
    if (!space) throw new ConflictException('Listing Rentable Space is unavailable.');
    await this.assertApplicantNotSelfRenting(space.propertyId, applicantPartyId, principal);
    return this.db.$transaction(async (tx) => {
      const row = await tx.rentalApplication.create({ data: { id: uuidv7(), companyId: principal.companyId, branchId: listing.branchId, applicationNumber: await nextRecordNumber(tx, 'APPLICATION'), leadId: lead.id, rentalListingId: listing.id, rentableSpaceId: listing.rentableSpaceId, applicantPartyId: input.applicantPartyId ?? lead.partyId, createdByUserId: principal.userId } });
      await this.audit.write(tx, { actorUserId: principal.userId, action: 'application.created', entityType: 'RentalApplication', entityId: row.id, branchId: row.branchId, correlationId, after: { applicationNumber: row.applicationNumber, leadId: row.leadId, rentalListingId: row.rentalListingId } });
      return row;
    }).catch((error: unknown) => { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('This Lead already has an Application for the Listing.'); throw error; });
  }

  async transitionApplication(principal: AuthenticatedPrincipal, id: string, input: ApplicationTransitionDto, correlationId?: string) {
    const current = await this.db.rentalApplication.findFirst({ where: { id, companyId: principal.companyId } });
    if (!current) throw new NotFoundException('Application not found.');
    const permission = oneOf(input.status, [ApplicationStatus.UNDER_REVIEW, ApplicationStatus.APPROVED, ApplicationStatus.REJECTED]) ? 'application.review' : 'application.create';
    this.auth.assertBranchPermission(principal, permission, current.branchId);
    if (!applicationTransitions[current.status].includes(input.status)) throw new ConflictException(`Application cannot transition from ${current.status} to ${input.status}.`);
    if (input.status === ApplicationStatus.APPROVED && !oneOf(current.screeningStatus, [ScreeningStatus.PASSED, ScreeningStatus.WAIVED])) throw new ConflictException('Screening must pass or be formally waived before approval.');
    const timestamp = new Date();
    return this.db.$transaction(async (tx) => {
      const changed = await tx.rentalApplication.updateMany({ where: { id, version: input.expectedVersion, status: current.status }, data: { status: input.status, version: { increment: 1 }, ...(input.status === ApplicationStatus.SUBMITTED ? { submittedAt: timestamp } : {}), ...(oneOf(input.status, [ApplicationStatus.APPROVED, ApplicationStatus.REJECTED]) ? { decidedAt: timestamp, decisionReason: input.reason } : {}) } });
      if (changed.count !== 1) throw new ConflictException('Application is stale or has already changed.');
      const row = await tx.rentalApplication.findUniqueOrThrow({ where: { id } });
      await this.audit.write(tx, { actorUserId: principal.userId, action: 'application.transitioned', entityType: 'RentalApplication', entityId: id, branchId: current.branchId, correlationId, reason: input.reason, before: { status: current.status }, after: { status: row.status } });
      return row;
    });
  }

  async recordScreening(principal: AuthenticatedPrincipal, id: string, input: RecordScreeningDto, correlationId?: string) {
    const current = await this.db.rentalApplication.findFirst({ where: { id, companyId: principal.companyId } });
    if (!current) throw new NotFoundException('Application not found.');
    this.auth.assertBranchPermission(principal, 'screening.manage', current.branchId);
    if (!oneOf(current.status, [ApplicationStatus.SUBMITTED, ApplicationStatus.UNDER_REVIEW])) throw new ConflictException('Screening is available only for a submitted Application under review.');
    const allowed = current.screeningStatus === ScreeningStatus.NOT_STARTED ? [ScreeningStatus.IN_PROGRESS, ScreeningStatus.WAIVED] : current.screeningStatus === ScreeningStatus.IN_PROGRESS ? [ScreeningStatus.PASSED, ScreeningStatus.FAILED, ScreeningStatus.WAIVED] : [];
    if (!oneOf<ScreeningStatus>(input.screeningStatus, allowed)) throw new ConflictException(`Screening cannot transition from ${current.screeningStatus} to ${input.screeningStatus}.`);
    return this.db.$transaction(async (tx) => {
      const changed = await tx.rentalApplication.updateMany({ where: { id, version: input.expectedVersion, screeningStatus: current.screeningStatus }, data: { screeningStatus: input.screeningStatus, screeningSummaryEncrypted: input.summary ? this.cipher.encrypt({ summary: input.summary.trim() }) : current.screeningSummaryEncrypted, version: { increment: 1 } } });
      if (changed.count !== 1) throw new ConflictException('Application is stale or screening has already changed.');
      const row = await tx.rentalApplication.findUniqueOrThrow({ where: { id } });
      await this.audit.write(tx, { actorUserId: principal.userId, action: 'application.screening-recorded', entityType: 'RentalApplication', entityId: id, branchId: current.branchId, correlationId, reason: input.reason, before: { screeningStatus: current.screeningStatus }, after: { screeningStatus: row.screeningStatus } });
      const { screeningSummaryEncrypted, ...safe } = row;
      void screeningSummaryEncrypted;
      return safe;
    });
  }

  async listReservations(principal: AuthenticatedPrincipal, query: ReservationQueryDto) {
    const branchIds = this.branches(principal, 'reservation.read', query.branchId);
    const where: Prisma.ReservationWhereInput = { companyId: principal.companyId, ...(branchIds === null ? {} : { branchId: { in: branchIds } }), ...(query.status ? { status: query.status } : {}), ...(query.cursor ? { id: { lt: query.cursor } } : {}), ...(query.search ? { OR: [{ reservationNumber: { contains: query.search, mode: 'insensitive' } }, { application: { is: { applicationNumber: { contains: query.search, mode: 'insensitive' } } } }, { rentableSpace: { is: { name: { contains: query.search, mode: 'insensitive' } } } }] } : {}) };
    const rows = await this.db.reservation.findMany({ where, orderBy: { id: 'desc' }, take: query.limit + 1, include: { application: { select: { id: true, applicationNumber: true, lead: { select: { displayName: true } } } }, rentableSpace: { select: { id: true, spaceCode: true, name: true } }, rentalListing: { select: { id: true, listingNumber: true, title: true } } } });
    return this.page(rows, query.limit);
  }

  async createReservation(principal: AuthenticatedPrincipal, input: CreateReservationDto, correlationId?: string) {
    const startsAt = new Date(input.startsAt); const expiresAt = new Date(input.expiresAt);
    if (expiresAt <= startsAt) throw new BadRequestException('Reservation expiry must be after its start.');
    if (expiresAt <= new Date(`${principal.businessDate}T00:00:00.000Z`)) throw new BadRequestException('Reservation expiry must be after the current Business Date.');
    const application = await this.db.rentalApplication.findFirst({ where: { id: input.applicationId, companyId: principal.companyId, status: ApplicationStatus.APPROVED }, include: { rentalListing: { include: { serviceEngagement: true } } } });
    if (!application) throw new ConflictException('An approved Application is required.');
    this.auth.assertBranchPermission(principal, 'reservation.create', application.branchId);
    const listing = application.rentalListing;
    if (!listing) throw new ConflictException('A legacy listing is required for Reservations.');
    if (!this.capabilities(listing.serviceEngagement).canReserveSpace) throw new ConflictException('The Service Engagement does not permit Reservations.');
    await assertHierarchyOccupancyAvailable(this.db, {
      companyId: principal.companyId,
      rentableSpaceId: application.rentableSpaceId,
      businessDate: principal.businessDate,
    });
    return this.db.$transaction(async (tx) => {
      const row = await tx.reservation.create({ data: { id: uuidv7(), companyId: principal.companyId, branchId: application.branchId, reservationNumber: await nextRecordNumber(tx, 'RESERVATION'), applicationId: application.id, rentalListingId: listing.id, rentableSpaceId: application.rentableSpaceId, startsAt, expiresAt, createdByUserId: principal.userId } });
      await this.audit.write(tx, { actorUserId: principal.userId, action: 'reservation.created', entityType: 'Reservation', entityId: row.id, branchId: row.branchId, correlationId, after: { reservationNumber: row.reservationNumber, applicationId: row.applicationId, startsAt, expiresAt } });
      return row;
    }).catch((error: unknown) => {
      if (isDatabaseConcurrencyConflict(error)) throw new ConflictException('The Rentable Space already has an overlapping active Reservation.');
      throw error;
    });
  }

  async transitionReservation(principal: AuthenticatedPrincipal, id: string, input: ReservationTransitionDto, correlationId?: string) {
    const current = await this.db.reservation.findFirst({ where: { id, companyId: principal.companyId } });
    if (!current) throw new NotFoundException('Reservation not found.');
    this.auth.assertBranchPermission(principal, 'reservation.manage', current.branchId);
    if (current.status !== ReservationStatus.ACTIVE || !oneOf(input.status, [ReservationStatus.EXPIRED, ReservationStatus.CANCELLED, ReservationStatus.CONVERTED])) throw new ConflictException(`Reservation cannot transition from ${current.status} to ${input.status}.`);
    return this.db.$transaction(async (tx) => {
      const changed = await tx.reservation.updateMany({ where: { id, version: input.expectedVersion, status: ReservationStatus.ACTIVE }, data: { status: input.status, reason: input.reason, version: { increment: 1 } } });
      if (changed.count !== 1) throw new ConflictException('Reservation is stale or has already changed.');
      const row = await tx.reservation.findUniqueOrThrow({ where: { id } });
      await this.audit.write(tx, { actorUserId: principal.userId, action: 'reservation.transitioned', entityType: 'Reservation', entityId: id, branchId: current.branchId, correlationId, reason: input.reason, before: { status: current.status }, after: { status: row.status } });
      return row;
    });
  }

  async listTenants(principal: AuthenticatedPrincipal, query: TenantQueryDto) {
    const branchIds = this.branches(principal, 'tenant.read');
    const where: Prisma.TenantProfileWhereInput = { companyId: principal.companyId, ...(query.cursor ? { partyId: { lt: query.cursor } } : {}), ...(query.search ? { OR: [{ tenantNumber: { contains: query.search, mode: 'insensitive' } }, { party: { is: { displayName: { contains: query.search, mode: 'insensitive' } } } }] } : {}), ...(branchIds === null ? {} : { party: { leaseParties: { some: { lease: { branchId: { in: branchIds } } } } } }) };
    const rows = await this.db.tenantProfile.findMany({ where, orderBy: { partyId: 'desc' }, take: query.limit + 1, include: { party: { select: { id: true, partyNumber: true, displayName: true, kind: true } } } });
    return this.page(rows.map((row) => ({ ...row, id: row.partyId })), query.limit);
  }

  async convertTenant(principal: AuthenticatedPrincipal, input: ConvertTenantDto, correlationId?: string) {
    const application = await this.db.rentalApplication.findFirst({ where: { id: input.applicationId, companyId: principal.companyId, status: ApplicationStatus.APPROVED }, include: { lead: true } });
    if (!application) throw new ConflictException('An approved Application is required.');
    this.auth.assertBranchPermission(principal, 'tenant.create', application.branchId);
    const partyId = application.applicantPartyId ?? application.lead.partyId;
    if (!partyId) throw new ConflictException('Convert or link the Applicant to a canonical Party first.');
    const party = await this.db.party.findFirst({ where: { id: partyId, companyId: principal.companyId }, select: { id: true } });
    if (!party) throw new ConflictException('Applicant Party is unavailable.');
    const space = await this.db.rentableSpace.findFirst({
      where: { id: application.rentableSpaceId, property: { companyId: principal.companyId } },
      select: { propertyId: true },
    });
    if (!space) throw new ConflictException('Application Rentable Space is unavailable.');
    await this.assertApplicantNotSelfRenting(space.propertyId, partyId, principal);
    try {
      return await this.db.$transaction(async (tx) => {
        const existing = await tx.tenantProfile.findUnique({ where: { partyId } });
        if (existing) return existing;
        const row = await tx.tenantProfile.create({ data: { partyId, companyId: principal.companyId, tenantNumber: await nextRecordNumber(tx, 'TENANT'), status: TenantStatus.ACTIVE } });
        await this.audit.write(tx, { actorUserId: principal.userId, action: 'tenant.created', entityType: 'TenantProfile', entityId: partyId, branchId: application.branchId, correlationId, after: { tenantNumber: row.tenantNumber, applicationId: application.id } });
        return row;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.db.tenantProfile.findUnique({ where: { partyId } });
        if (existing) return existing;
      }
      throw error;
    }
  }

  async listLeases(principal: AuthenticatedPrincipal, query: LeaseQueryDto) {
    const branchIds = this.branches(principal, 'lease.read', query.branchId);
    const where: Prisma.LeaseWhereInput = { companyId: principal.companyId, ...(branchIds === null ? {} : { branchId: { in: branchIds } }), ...(query.status ? { status: query.status } : {}), ...(query.rentableSpaceId ? { rentableSpaceId: query.rentableSpaceId } : {}), ...(query.cursor ? { id: { lt: query.cursor } } : {}), ...(query.search ? { OR: [{ leaseNumber: { contains: query.search, mode: 'insensitive' } }, { rentableSpace: { is: { name: { contains: query.search, mode: 'insensitive' } } } }, { parties: { some: { party: { displayName: { contains: query.search, mode: 'insensitive' } } } } }] } : {}) };
    const rows = await this.db.lease.findMany({ where, orderBy: { id: 'desc' }, take: query.limit + 1, include: { rentableSpace: { select: { id: true, spaceCode: true, name: true, property: { select: { id: true, propertyCode: true, name: true } } } }, parties: { include: { party: { select: { id: true, displayName: true } } } }, moveIn: true } });
    return this.page(rows, query.limit);
  }

  async getLease(principal: AuthenticatedPrincipal, id: string) {
    const row = await this.db.lease.findFirst({
      where: { id, companyId: principal.companyId },
      include: {
        rentableSpace: {
          select: {
            id: true,
            spaceCode: true,
            name: true,
            property: { select: { id: true, propertyCode: true, name: true, city: true } },
          },
        },
        parties: { include: { party: { select: { id: true, displayName: true } } } },
        moveIn: true,
        application: {
          select: {
            id: true,
            applicationNumber: true,
            lead: { select: { id: true, displayName: true, leadNumber: true } },
          },
        },
        serviceEngagement: {
          select: { id: true, engagementNumber: true, serviceModel: true, status: true },
        },
        possessions: {
          orderBy: { possessionFrom: 'desc' },
          take: 5,
        },
      },
    });
    if (!row) throw new NotFoundException('Lease not found.');
    this.auth.assertBranchPermission(principal, 'lease.read', row.branchId);
    const renewals = await this.db.leaseRenewal.findMany({
      where: { originalLeaseId: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, status: true, proposedRent: true, currency: true },
    });
    return { ...row, renewals };
  }

  async createLease(principal: AuthenticatedPrincipal, input: CreateLeaseDto, correlationId?: string) {
    const start = new Date(input.leaseStartDate); const end = new Date(input.leaseEndDate);
    if (end <= start) throw new BadRequestException('Lease End Date must be after Lease Start Date.');
    if (!input.parties.some((party) => party.role === LeasePartyRole.TENANT)) throw new BadRequestException('At least one Tenant party is required.');
    assertDistinctLeaseParties(input.parties);
    const application = await this.db.rentalApplication.findFirst({ where: { id: input.applicationId, companyId: principal.companyId, status: ApplicationStatus.APPROVED }, include: { rentalListing: true } });
    if (!application) throw new ConflictException('An approved Application is required.');
    this.auth.assertBranchPermission(principal, 'lease.create', application.branchId);
    const space = await this.db.rentableSpace.findFirst({ where: { id: application.rentableSpaceId, property: { companyId: principal.companyId } }, select: { propertyId: true } });
    if (!space) throw new ConflictException('Application Rentable Space is unavailable.');
    const engagement = await this.activeEngagement(principal, input.serviceEngagementId, space.propertyId, application.rentableSpaceId);
    if (!this.capabilities(engagement).canCreateLease) throw new ConflictException('The Service Engagement does not permit Lease creation.');
    const partyIds = [...new Set(input.parties.map((party) => party.partyId))];
    const parties = await this.db.party.findMany({ where: { id: { in: partyIds }, companyId: principal.companyId }, select: { id: true, tenant: { select: { status: true } } } });
    if (parties.length !== partyIds.length) throw new ConflictException('One or more Lease parties are unavailable.');
    for (const party of input.parties.filter((item) => item.role === LeasePartyRole.TENANT)) if (parties.find((row) => row.id === party.partyId)?.tenant?.status !== TenantStatus.ACTIVE) throw new ConflictException('Every Tenant party must have an active Tenant profile.');
    await assertPartiesNotPropertyOwners(
      this.db.propertyOwnership,
      space.propertyId,
      input.parties.filter((party) => party.role === LeasePartyRole.TENANT).map((party) => party.partyId),
      this.ownershipAsOf(principal),
    );
    return this.db.$transaction(async (tx) => {
      const number = await nextRecordNumber(tx, 'LEASE');
      const id = uuidv7();
      const row = await tx.lease.create({ data: { id, companyId: principal.companyId, branchId: application.branchId, leaseNumber: number, rentableSpaceId: application.rentableSpaceId, serviceEngagementId: engagement.id, applicationId: application.id, leaseStartDate: start, leaseEndDate: end, rentAmount: new Prisma.Decimal(input.rentAmount), currency: input.currency.toUpperCase(), createdByUserId: principal.userId, parties: { create: input.parties.map((party) => ({ id: uuidv7(), partyId: party.partyId, role: party.role })) }, versions: { create: { id: uuidv7(), sequence: 1, termsSnapshot: { leaseStartDate: input.leaseStartDate, leaseEndDate: input.leaseEndDate, rentAmount: input.rentAmount, currency: input.currency.toUpperCase() }, createdByUserId: principal.userId } } } });
      await tx.reservation.updateMany({ where: { applicationId: application.id, status: ReservationStatus.ACTIVE }, data: { status: ReservationStatus.CONVERTED, reason: `Converted to Lease ${number}`, version: { increment: 1 } } });
      await this.audit.write(tx, { actorUserId: principal.userId, action: 'lease.created', entityType: 'Lease', entityId: id, branchId: application.branchId, correlationId, after: { leaseNumber: number, rentableSpaceId: application.rentableSpaceId, applicationId: application.id } });
      return row;
    }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('A Lease already exists for this Application.');
      throw error;
    });
  }

  /** Creates the lease that was agreed in the rental-agreement workflow. */
  async createLeaseFromAgreement(
    principal: AuthenticatedPrincipal,
    agreementId: string,
    correlationId?: string,
  ) {
    const agreement = await this.db.rentalAgreement.findFirst({
      where: { id: agreementId, companyId: principal.companyId, status: 'CONFIRMED' },
      include: { serviceEngagement: true },
    });
    if (!agreement) throw new NotFoundException('Confirmed rental agreement not found.');
    this.auth.assertBranchPermission(principal, 'lease.create', agreement.branchId);

    const engagement = await this.activeEngagement(
      principal,
      agreement.serviceEngagementId,
      agreement.propertyId,
      agreement.rentableSpaceId,
    );
    if (!this.capabilities(engagement).canCreateLease) {
      throw new ConflictException('The Service Engagement does not permit Lease creation.');
    }

    const [space, parties] = await Promise.all([
      this.db.rentableSpace.findFirst({
        where: { id: agreement.rentableSpaceId, propertyId: agreement.propertyId, status: RentableSpaceStatus.ACTIVE },
        select: { id: true, propertyId: true },
      }),
      this.db.party.findMany({
        where: { id: { in: [agreement.customerPartyId, agreement.ownerPartyId] }, companyId: principal.companyId },
        select: { id: true },
      }),
    ]);
    if (!space || parties.length !== 2) throw new ConflictException('The agreement parties or unit are unavailable.');
    if (agreement.customerPartyId === agreement.ownerPartyId) {
      throw new ConflictException('A property owner cannot rent their own property.');
    }
    await assertPartiesNotPropertyOwners(
      this.db.propertyOwnership,
      agreement.propertyId,
      [agreement.customerPartyId],
      this.ownershipAsOf(principal),
    );
    await assertHierarchyOccupancyAvailable(this.db, {
      companyId: principal.companyId,
      rentableSpaceId: agreement.rentableSpaceId,
      businessDate: principal.businessDate,
    });

    try {
      return await this.db.$transaction(async (tx) => {
        const existingTenant = await tx.tenantProfile.findUnique({ where: { partyId: agreement.customerPartyId } });
        if (!existingTenant) {
          await tx.tenantProfile.create({
            data: {
              partyId: agreement.customerPartyId,
              companyId: principal.companyId,
              tenantNumber: await nextRecordNumber(tx, 'TENANT'),
              status: TenantStatus.ACTIVE,
            },
          });
        } else if (existingTenant.status !== TenantStatus.ACTIVE) {
          throw new ConflictException('The agreement customer does not have an active Tenant profile.');
        }

        const lease = await tx.lease.create({
          data: {
            id: uuidv7(),
            companyId: principal.companyId,
            branchId: agreement.branchId,
            leaseNumber: await nextRecordNumber(tx, 'LEASE'),
            rentalAgreementId: agreement.id,
            rentableSpaceId: agreement.rentableSpaceId,
            serviceEngagementId: agreement.serviceEngagementId,
            leaseStartDate: agreement.leaseStartDate,
            leaseEndDate: agreement.leaseEndDate,
            rentAmount: agreement.finalRent,
            currency: agreement.currency,
            createdByUserId: principal.userId,
            parties: {
              create: [
                { id: uuidv7(), partyId: agreement.customerPartyId, role: LeasePartyRole.TENANT },
                { id: uuidv7(), partyId: agreement.ownerPartyId, role: LeasePartyRole.LANDLORD },
              ],
            },
            versions: {
              create: {
                id: uuidv7(),
                sequence: 1,
                termsSnapshot: {
                  leaseStartDate: agreement.leaseStartDate.toISOString().slice(0, 10),
                  leaseEndDate: agreement.leaseEndDate?.toISOString().slice(0, 10) ?? null,
                  rentAmount: agreement.finalRent.toString(),
                  currency: agreement.currency,
                  agreementId: agreement.id,
                },
                createdByUserId: principal.userId,
              },
            },
          },
        });
        await this.audit.write(tx, {
          actorUserId: principal.userId,
          action: 'lease.created-from-agreement',
          entityType: 'Lease',
          entityId: lease.id,
          branchId: agreement.branchId,
          correlationId,
          after: { leaseNumber: lease.leaseNumber, agreementId: agreement.id },
        });
        return lease;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A lease already exists for this rental agreement.');
      }
      throw error;
    }
  }

  async transitionLease(principal: AuthenticatedPrincipal, id: string, input: LeaseTransitionDto, correlationId?: string) {
    const current = await this.db.lease.findFirst({ where: { id, companyId: principal.companyId }, include: { parties: true } });
    if (!current) throw new NotFoundException('Lease not found.');
    const permission =
      input.status === LeaseStatus.ACTIVE && current.status === LeaseStatus.PENDING_APPROVAL
        ? 'lease.approve'
        : input.status === LeaseStatus.APPROVED
          ? 'lease.approve'
          : input.status === LeaseStatus.SIGNED
            ? 'lease.sign'
            : input.status === LeaseStatus.ACTIVE
              ? 'lease.activate'
              : 'lease.manage';
    this.auth.assertBranchPermission(principal, permission, current.branchId);
    if (!leaseTransitions[current.status].includes(input.status)) throw new ConflictException(`Lease cannot transition from ${current.status} to ${input.status}.`);
    if (current.status === LeaseStatus.ACTIVE && input.status === LeaseStatus.ENDED) {
      throw new ConflictException('Use the Move-Out action to end an active Lease.');
    }
    if (input.status === LeaseStatus.SIGNED && !input.signatureHash) throw new BadRequestException('Signature evidence hash is required.');
    const activating = input.status === LeaseStatus.ACTIVE;
    const captureAgreement =
      activating ||
      input.status === LeaseStatus.SIGNED ||
      (current.status === LeaseStatus.PENDING_APPROVAL && input.status === LeaseStatus.ACTIVE);
    if (activating) {
      await assertHierarchyOccupancyAvailable(this.db, {
        companyId: principal.companyId,
        rentableSpaceId: current.rentableSpaceId,
        businessDate: principal.businessDate,
        excludeLeaseId: current.id,
      });
    }
    try {
      return await this.db.$transaction(async (tx) => {
        if (activating) {
          await assertActiveResidentialTenancyAvailable(tx, {
            companyId: principal.companyId,
            rentableSpaceId: current.rentableSpaceId,
            tenantPartyIds: current.parties
              .filter((party) => party.role === LeasePartyRole.TENANT)
              .map((party) => party.partyId),
            excludeLeaseId: current.id,
          });
        }
        const changed = await tx.lease.updateMany({
          where: { id, version: input.expectedVersion, status: current.status },
          data: {
            status: input.status,
            agreementDate:
              captureAgreement && !current.agreementDate
                ? new Date(principal.businessDate)
                : current.agreementDate,
            version: { increment: 1 },
          },
        });
        if (changed.count !== 1) throw new ConflictException('Lease is stale or has already changed.');
        if (input.status === LeaseStatus.SIGNED || (activating && !current.agreementDate)) {
          const latest = await tx.leaseVersion.aggregate({ where: { leaseId: id }, _max: { sequence: true } });
          await tx.leaseVersion.create({
            data: {
              id: uuidv7(),
              leaseId: id,
              sequence: (latest._max.sequence ?? 0) + 1,
              termsSnapshot: {
                leaseStartDate: current.leaseStartDate.toISOString().slice(0, 10),
                leaseEndDate: current.leaseEndDate
                  ? current.leaseEndDate.toISOString().slice(0, 10)
                  : null,
                rentAmount: current.rentAmount.toString(),
                currency: current.currency,
                partyIds: current.parties.map((party) => party.partyId),
                activatedOnApprove: activating && current.status === LeaseStatus.PENDING_APPROVAL,
              },
              documentId: input.documentId ?? null,
              signatureHash:
                input.signatureHash ??
                (activating ? `approved:${principal.businessDate}:${id}` : null),
              signedAt: new Date(),
              createdByUserId: principal.userId,
            },
          });
        }
        if (activating) {
          await tx.leasePossession.create({
            data: {
              id: uuidv7(),
              leaseId: id,
              rentableSpaceId: current.rentableSpaceId,
              possessionFrom: new Date(`${current.leaseStartDate.toISOString().slice(0, 10)}T00:00:00.000Z`),
              possessionTo: current.leaseEndDate
                ? new Date(`${current.leaseEndDate.toISOString().slice(0, 10)}T00:00:00.000Z`)
                : null,
              status: LeasePossessionStatus.ACTIVE,
            },
          });
        }
        if (oneOf(input.status, [LeaseStatus.ENDED, LeaseStatus.TERMINATED])) await tx.leasePossession.updateMany({ where: { leaseId: id, status: LeasePossessionStatus.ACTIVE }, data: { status: LeasePossessionStatus.ENDED, possessionTo: new Date() } });
        const row = await tx.lease.findUniqueOrThrow({ where: { id } });
        await this.audit.write(tx, { actorUserId: principal.userId, action: 'lease.transitioned', entityType: 'Lease', entityId: id, branchId: current.branchId, correlationId, reason: input.reason, before: { status: current.status, version: current.version }, after: { status: row.status, version: row.version } });
        return row;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (isActiveResidentialTenancyConstraint(error)) {
        throw new ConflictException(ACTIVE_RESIDENTIAL_TENANCY_MESSAGE);
      }
      if (isDatabaseConcurrencyConflict(error)) throw new ConflictException('Lease activation conflicts with an existing active possession.');
      throw error;
    }
  }

  async moveOut(principal: AuthenticatedPrincipal, id: string, input: MoveOutDto, correlationId?: string) {
    const current = await this.db.lease.findFirst({
      where: { id, companyId: principal.companyId },
      include: {
        rentableSpace: { select: { id: true, name: true, property: { select: { id: true, name: true } } } },
        parties: { include: { party: { select: { displayName: true } } } },
        possessions: { where: { status: LeasePossessionStatus.ACTIVE }, orderBy: { possessionFrom: 'desc' }, take: 1 },
      },
    });
    if (!current) throw new NotFoundException('Lease not found.');
    this.auth.assertBranchPermission(principal, 'lease.manage', current.branchId);
    if (current.status !== LeaseStatus.ACTIVE) throw new ConflictException('Only an active Lease can be moved out.');
    const moveOutAt = new Date(`${input.moveOutDate}T00:00:00.000Z`);
    if (Number.isNaN(moveOutAt.getTime())) throw new BadRequestException('Move-Out date is invalid.');
    const initialPossession = current.possessions[0];
    if (!initialPossession) throw new ConflictException('An active LeasePossession is required before Move-Out.');
    if (moveOutAt <= initialPossession.possessionFrom) {
      throw new BadRequestException('Move-Out date must be after possession started.');
    }
    if (current.leaseEndDate && moveOutAt > current.leaseEndDate) {
      throw new BadRequestException('Move-Out date cannot be after the Lease end date.');
    }

    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "leases" WHERE id = ${id}::uuid FOR UPDATE`);
      const latest = await tx.lease.findFirstOrThrow({
        where: { id, companyId: principal.companyId },
        include: { possessions: { where: { status: LeasePossessionStatus.ACTIVE }, orderBy: { possessionFrom: 'desc' }, take: 1 } },
      });
      if (latest.status !== LeaseStatus.ACTIVE) throw new ConflictException('Lease has already been moved out or otherwise ended.');
      if (latest.version !== input.expectedVersion) throw new ConflictException('Lease is stale or has already changed.');
      const possession = latest.possessions[0];
      if (!possession) throw new ConflictException('An active LeasePossession is required before Move-Out.');
      if (moveOutAt <= possession.possessionFrom) throw new BadRequestException('Move-Out date must be after possession started.');
      if (latest.leaseEndDate && moveOutAt > latest.leaseEndDate) throw new BadRequestException('Move-Out date cannot be after the Lease end date.');

      const endedPossession = await tx.leasePossession.updateMany({
        where: { id: possession.id, status: LeasePossessionStatus.ACTIVE },
        data: {
          status: LeasePossessionStatus.ENDED,
          possessionTo: moveOutAt,
          moveOutReason: input.reason.trim(),
          moveOutNotes: input.notes?.trim() || null,
        },
      });
      if (endedPossession.count !== 1) throw new ConflictException('Move-Out is stale or the possession has already ended.');
      const endedLease = await tx.lease.updateMany({
        where: { id, version: input.expectedVersion, status: LeaseStatus.ACTIVE },
        data: { status: LeaseStatus.ENDED, version: { increment: 1 } },
      });
      if (endedLease.count !== 1) throw new ConflictException('Lease is stale or has already changed.');
      const row = await tx.lease.findUniqueOrThrow({ where: { id } });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'lease.moved-out',
        entityType: 'Lease',
        entityId: id,
        branchId: latest.branchId,
        correlationId,
        reason: input.reason,
        before: { status: latest.status, version: latest.version, possessionId: possession.id },
        after: { status: row.status, version: row.version, moveOutDate: moveOutAt, possessionId: possession.id, notes: input.notes?.trim() || null },
      });
      return row;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async listRenewals(principal: AuthenticatedPrincipal, query: RenewalQueryDto) {
    const branches = this.branches(principal, 'renewal.read');
    const where: Prisma.LeaseRenewalWhereInput = { originalLease: { companyId: principal.companyId, ...(branches === null ? {} : { branchId: { in: branches } }), ...(query.search ? { leaseNumber: { contains: query.search, mode: 'insensitive' } } : {}) }, ...(query.status ? { status: query.status } : {}), ...(query.cursor ? { id: { lt: query.cursor } } : {}) };
    const rows = await this.db.leaseRenewal.findMany({ where, orderBy: { id: 'desc' }, take: query.limit + 1, include: { originalLease: { include: { rentableSpace: { select: { spaceCode: true, name: true } } } }, successorLease: { select: { id: true, leaseNumber: true, status: true } } } });
    return this.page(rows, query.limit);
  }

  async createRenewal(principal: AuthenticatedPrincipal, input: CreateRenewalDto, correlationId?: string) {
    const lease = await this.db.lease.findFirst({ where: { id: input.originalLeaseId, companyId: principal.companyId, status: { in: [LeaseStatus.SIGNED, LeaseStatus.ACTIVE] } } });
    if (!lease) throw new ConflictException('A Signed or Active Lease is required.');
    this.auth.assertBranchPermission(principal, 'renewal.manage', lease.branchId);
    if (!lease.leaseEndDate) throw new ConflictException('Open-ended leases cannot be renewed.');
    const start = new Date(input.proposedStartDate); const end = new Date(input.proposedEndDate);
    if (end <= start || start < lease.leaseEndDate) throw new BadRequestException('Renewal dates must begin at or after the existing Lease end and have a valid period.');
    return this.db.$transaction(async (tx) => {
      const row = await tx.leaseRenewal.create({ data: { id: uuidv7(), originalLeaseId: lease.id, proposedStartDate: start, proposedEndDate: end, proposedRent: new Prisma.Decimal(input.proposedRent), currency: input.currency.toUpperCase(), createdByUserId: principal.userId } });
      await this.audit.write(tx, { actorUserId: principal.userId, action: 'lease-renewal.created', entityType: 'LeaseRenewal', entityId: row.id, branchId: lease.branchId, correlationId, after: { originalLeaseId: lease.id, proposedStartDate: start, proposedEndDate: end } });
      return row;
    }).catch((error: unknown) => { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('An open Renewal already exists for this Lease.'); throw error; });
  }

  async transitionRenewal(principal: AuthenticatedPrincipal, id: string, input: RenewalTransitionDto, correlationId?: string) {
    const current = await this.db.leaseRenewal.findFirst({ where: { id, originalLease: { companyId: principal.companyId } }, include: { originalLease: { include: { parties: true } } } });
    if (!current) throw new NotFoundException('Lease Renewal not found.');
    this.auth.assertBranchPermission(principal, 'renewal.manage', current.originalLease.branchId);
    if (!renewalTransitions[current.status].includes(input.status)) throw new ConflictException(`Renewal cannot transition from ${current.status} to ${input.status}.`);
    return this.db.$transaction(async (tx) => {
      let successorLeaseId = current.successorLeaseId;
      if (input.status === RenewalStatus.ACTIVATED) {
        const successor = await tx.lease.create({ data: { id: uuidv7(), companyId: current.originalLease.companyId, branchId: current.originalLease.branchId, leaseNumber: await nextRecordNumber(tx, 'LEASE'), rentableSpaceId: current.originalLease.rentableSpaceId, serviceEngagementId: current.originalLease.serviceEngagementId, status: LeaseStatus.SIGNED, agreementDate: new Date(principal.businessDate), leaseStartDate: current.proposedStartDate, leaseEndDate: current.proposedEndDate, rentAmount: current.proposedRent, currency: current.currency, predecessorLeaseId: current.originalLeaseId, createdByUserId: principal.userId, parties: { create: current.originalLease.parties.map((party) => ({ id: uuidv7(), partyId: party.partyId, role: party.role })) }, versions: { create: { id: uuidv7(), sequence: 1, termsSnapshot: { leaseStartDate: current.proposedStartDate.toISOString().slice(0, 10), leaseEndDate: current.proposedEndDate.toISOString().slice(0, 10), rentAmount: current.proposedRent.toString(), currency: current.currency, renewalId: current.id }, createdByUserId: principal.userId } } } });
        successorLeaseId = successor.id;
      }
      const changed = await tx.leaseRenewal.updateMany({ where: { id, version: input.expectedVersion, status: current.status }, data: { status: input.status, successorLeaseId, version: { increment: 1 } } });
      if (changed.count !== 1) throw new ConflictException('Renewal is stale or has already changed.');
      const row = await tx.leaseRenewal.findUniqueOrThrow({ where: { id }, include: { successorLease: true } });
      await this.audit.write(tx, { actorUserId: principal.userId, action: 'lease-renewal.transitioned', entityType: 'LeaseRenewal', entityId: id, branchId: current.originalLease.branchId, correlationId, reason: input.reason, before: { status: current.status }, after: { status: row.status, successorLeaseId: row.successorLeaseId } });
      return row;
    });
  }

  async listMoveIns(principal: AuthenticatedPrincipal, query: MoveInQueryDto) {
    const branches = this.branches(principal, 'move-in.read');
    const where: Prisma.MoveInWhereInput = { lease: { companyId: principal.companyId, ...(branches === null ? {} : { branchId: { in: branches } }), ...(query.search ? { leaseNumber: { contains: query.search, mode: 'insensitive' } } : {}) }, ...(query.status ? { status: query.status } : {}), ...(query.cursor ? { id: { lt: query.cursor } } : {}) };
    const rows = await this.db.moveIn.findMany({ where, orderBy: { id: 'desc' }, take: query.limit + 1, include: { lease: { include: { rentableSpace: { select: { spaceCode: true, name: true } }, parties: { include: { party: { select: { displayName: true } } } } } } } });
    return this.page(rows, query.limit);
  }

  async scheduleMoveIn(principal: AuthenticatedPrincipal, input: ScheduleMoveInDto, correlationId?: string) {
    const lease = await this.db.lease.findFirst({ where: { id: input.leaseId, companyId: principal.companyId, status: { in: [LeaseStatus.SIGNED, LeaseStatus.ACTIVE] } } });
    if (!lease) throw new ConflictException('A Signed or Active Lease is required.');
    this.auth.assertBranchPermission(principal, 'move-in.manage', lease.branchId);
    const date = new Date(input.scheduledDate);
    if (date < lease.leaseStartDate || (lease.leaseEndDate && date >= lease.leaseEndDate)) throw new BadRequestException('Move-In date must be within the Lease period.');
    return this.db.$transaction(async (tx) => {
      const row = await tx.moveIn.create({ data: { id: uuidv7(), leaseId: lease.id, scheduledDate: date, notes: input.notes?.trim() || null, recordedByUserId: principal.userId } });
      await this.audit.write(tx, { actorUserId: principal.userId, action: 'move-in.scheduled', entityType: 'MoveIn', entityId: row.id, branchId: lease.branchId, correlationId, after: { leaseId: lease.id, scheduledDate: date } });
      return row;
    }).catch((error: unknown) => { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Move-In is already scheduled for this Lease.'); throw error; });
  }

  async transitionMoveIn(principal: AuthenticatedPrincipal, id: string, input: MoveInTransitionDto, correlationId?: string) {
    const current = await this.db.moveIn.findFirst({ where: { id, lease: { companyId: principal.companyId } }, include: { lease: true } });
    if (!current) throw new NotFoundException('Move-In not found.');
    this.auth.assertBranchPermission(principal, 'move-in.manage', current.lease.branchId);
    if (current.status !== MoveInStatus.SCHEDULED || !oneOf(input.status, [MoveInStatus.COMPLETED, MoveInStatus.CANCELLED])) throw new ConflictException(`Move-In cannot transition from ${current.status} to ${input.status}.`);
    if (input.status === MoveInStatus.COMPLETED && current.lease.status !== LeaseStatus.ACTIVE) throw new ConflictException('Activate the Lease before completing Move-In.');
    return this.db.$transaction(async (tx) => {
      const changed = await tx.moveIn.updateMany({ where: { id, version: input.expectedVersion, status: MoveInStatus.SCHEDULED }, data: { status: input.status, completedDate: input.status === MoveInStatus.COMPLETED ? new Date(input.completedDate ?? principal.businessDate) : null, notes: input.notes?.trim() || current.notes, version: { increment: 1 } } });
      if (changed.count !== 1) throw new ConflictException('Move-In is stale or has already changed.');
      const row = await tx.moveIn.findUniqueOrThrow({ where: { id } });
      await this.audit.write(tx, { actorUserId: principal.userId, action: 'move-in.transitioned', entityType: 'MoveIn', entityId: id, branchId: current.lease.branchId, correlationId, reason: input.reason, before: { status: current.status }, after: { status: row.status, completedDate: row.completedDate } });
      return row;
    });
  }
}
