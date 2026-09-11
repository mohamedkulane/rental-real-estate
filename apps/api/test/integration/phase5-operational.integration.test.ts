import { randomUUID } from 'node:crypto';
import {
  ApplicationStatus,
  BranchAccessMode,
  LeasePartyRole,
  LeaseStatus,
  ListingStatus,
  MoveInStatus,
  PrismaClient,
  RenewalStatus,
  ScreeningStatus,
  ServiceModel,
  ViewingStatus,
  WorkflowType,
} from '@prisma/client';
import type { ApiEnvironment } from '@rerms/config';
import { uuidv7 } from '@rerms/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditService } from '../../src/governance/audit.service';
import { LeasingService } from '../../src/leasing/leasing.service';
import { ListingService } from '../../src/leasing/listing.service';
import { AuthorizationService } from '../../src/security/authorization.service';
import type { AuthenticatedPrincipal } from '../../src/security/security.types';
import { WorkflowPayloadCipher } from '../../src/workflow/workflow-payload-cipher';
import { WorkflowService } from '../../src/workflow/workflow.service';

const url = process.env.PHASE5_TEST_DATABASE_URL;
const permissionCodes = [
  'workflow.draft.read', 'workflow.draft.update', 'workflow.draft.cancel', 'workflow.draft.complete',
  'party.read', 'owner.read', 'portfolio.property.read', 'portfolio.property.create',
  'portfolio.ownership.read', 'portfolio.ownership.manage', 'portfolio.building.read',
  'portfolio.building.manage', 'portfolio.space.read', 'portfolio.space.create',
  'portfolio.document.read', 'portfolio.document.manage', 'service-engagement.read',
  'service-engagement.activate', 'listing.read', 'listing.create', 'listing.review',
  'listing.publish', 'listing.match', 'viewing.read', 'viewing.create', 'viewing.update',
  'viewing.complete', 'application.read', 'application.create', 'application.review',
  'screening.manage', 'reservation.read', 'reservation.create', 'reservation.manage',
  'tenant.read', 'tenant.create', 'lease.read', 'lease.create', 'lease.approve',
  'lease.sign', 'lease.activate', 'lease.manage', 'renewal.read', 'renewal.manage',
  'move-in.read', 'move-in.manage',
];

describe.skipIf(!url)('Phase 5 operational workflows', () => {
  let database: PrismaClient;
  let principal: AuthenticatedPrincipal;
  let listings: ListingService;
  let leasing: LeasingService;
  let workflows: WorkflowService;
  let companyId: string;
  let branchId: string;
  let userId: string;
  let employeeId: string;
  let companyPartyId: string;
  let propertyId: string;
  let ownershipId: string;
  let engagementId: string;
  let leadId: string;
  let secondLeadId: string;
  let applicantPartyId: string;
  const publishedListingIds: string[] = [];
  let activeLeaseId = '';
  const suffix = randomUUID().slice(0, 8).toUpperCase();

  beforeAll(async () => {
    if (!url || !/^\/rerms_phase5_[a-z0-9_]+$/u.test(new URL(url).pathname)) throw new Error('Phase 5 tests require a dedicated rerms_phase5_* database.');
    database = new PrismaClient({ datasourceUrl: url, transactionOptions: { timeout: 60_000 } });
    const company = await database.company.findFirstOrThrow();
    const branch = await database.branch.findFirstOrThrow({ where: { companyId: company.id, code: 'HQ', active: true } });
    const user = await database.user.findFirstOrThrow({ where: { employee: { companyId: company.id } } });
    const employee = await database.employee.findFirstOrThrow({ where: { userId: user.id } });
    const source = await database.leadSource.findFirstOrThrow({ where: { companyId: company.id, status: 'ACTIVE' } });
    const applicant = await database.party.create({ data: {
      id: uuidv7(), companyId: company.id, partyNumber: `APP-P5-${suffix}`,
      kind: 'PERSON', displayName: `Test Applicant ${suffix}`,
      person: { create: { givenName: 'Test', familyName: `Applicant ${suffix}` } },
      branchAssignments: { create: { id: uuidv7(), branchId: branch.id, effectiveFrom: new Date('2026-01-01') } },
    } });
    const type = await database.rentableSpaceType.findFirstOrThrow({ where: { active: true } });
    companyId = company.id; branchId = branch.id; userId = user.id; employeeId = employee.id;
    companyPartyId = company.legalPartyId!; applicantPartyId = applicant.id;
    propertyId = uuidv7(); ownershipId = uuidv7(); engagementId = uuidv7();
    await database.property.create({ data: {
      id: propertyId, companyId, propertyCode: `P5-${suffix}`, name: `Phase 5 ${suffix}`,
      propertyType: 'APARTMENT_BUILDING', status: 'ACTIVE', city: 'Mogadishu',
      branchAssignments: { create: { id: uuidv7(), branchId, effectiveFrom: new Date('2026-01-01') } },
      ownerships: { create: { id: ownershipId, ownerPartyId: companyPartyId, ownershipPercent: '100', effectiveFrom: new Date('2026-01-01') } },
    } });
    const spaces = await Promise.all(Array.from({ length: 4 }, (_, index) => database.rentableSpace.create({ data: {
      id: uuidv7(), propertyId, typeId: type.id, spaceCode: `P5-${suffix}-${index + 1}`, name: `Phase 5 Space ${index + 1}`, status: 'ACTIVE',
    } })));
    await database.serviceEngagement.create({ data: {
      id: engagementId, companyId, engagementNumber: `ENG-P5-${suffix}`, serviceModel: ServiceModel.COMPANY_OWNED,
      status: 'ACTIVE', propertyId, effectiveFrom: new Date('2026-01-01'), createdByUserId: userId,
    } });
    const createLead = async (name: string) => database.lead.create({ data: {
      id: uuidv7(), companyId, leadNumber: `LEAD-P5-${suffix}-${name}`, intent: 'RENT', sourceId: source.id,
      responsibleBranchId: branchId, currentAssigneeEmployeeId: employeeId, partyId: applicantPartyId,
      displayName: `Phase 5 Applicant ${name}`, createdByUserId: userId,
      preferenceVersions: { create: { id: uuidv7(), intent: 'RENT', versionNo: 1, effectiveFrom: new Date(), actorUserId: userId,
        rent: { create: { minRent: '100', maxRent: '5000', currency: 'USD' } } } },
    } });
    leadId = (await createLead('A')).id; secondLeadId = (await createLead('B')).id;
    principal = {
      userId, employeeId, sessionId: randomUUID(), companyId, businessDate: '2026-09-04',
      accessMode: BranchAccessMode.COMPANY_WIDE, roles: [], permissions: new Set(permissionCodes),
      permissionBranchScopes: new Map(permissionCodes.map((permission) => [permission, new Set<string | null>([null])])),
      branchIds: new Set([branchId]),
    };
    const auth = new AuthorizationService(); const audit = new AuditService();
    const environment = { PARTY_DATA_ENCRYPTION_KEY_VERSION: 'v1', PARTY_DATA_ENCRYPTION_KEY: '11'.repeat(32) } as ApiEnvironment;
    const cipher = new WorkflowPayloadCipher(environment);
    listings = new ListingService(database as never, auth, audit);
    leasing = new LeasingService(database as never, auth, audit, cipher);
    workflows = new WorkflowService(database as never, auth, audit, cipher);
    for (const [index, space] of spaces.entries()) {
      const draft = await listings.createRental(principal, { rentableSpaceId: space.id, serviceEngagementId: engagementId, title: `Phase 5 Listing ${index + 1}`, askingRent: String(1000 + index), currency: 'USD' });
      const submitted = await listings.transitionRental(principal, draft.id, ListingStatus.PENDING_REVIEW, { expectedVersion: draft.version, reason: 'Integration review' });
      const published = await listings.transitionRental(principal, draft.id, ListingStatus.PUBLISHED, { expectedVersion: submitted.version, reason: 'Integration publication' });
      publishedListingIds.push(published.id);
    }
  }, 120_000);

  afterAll(async () => database?.$disconnect());

  it('uses complete cursor pages, deterministic matching, and branch/company isolation', async () => {
    const first = await listings.listRental(principal, { limit: 2 });
    expect(first.items).toHaveLength(2); expect(first.pageInfo.hasNextPage).toBe(true); expect(first.total).toBeGreaterThanOrEqual(4);
    const second = await listings.listRental(principal, { limit: 2, cursor: first.pageInfo.nextCursor! });
    expect(new Set([...first.items, ...second.items].map((row) => row.id)).size).toBe(4);
    const matches = await listings.match(principal, { leadId, limit: 2 });
    expect(matches.items).toHaveLength(2); expect(matches.items[0]?.score).toBe(100); expect(matches.items[0]?.reasons.length).toBeGreaterThan(0);
    const disjoint = { ...principal, accessMode: BranchAccessMode.BRANCH, permissionBranchScopes: new Map(permissionCodes.map((permission) => [permission, new Set<string | null>([randomUUID()])])) };
    expect((await listings.listRental(disjoint, { limit: 25 })).items).toHaveLength(0);
    expect((await listings.listRental({ ...principal, companyId: randomUUID() }, { limit: 25 })).items).toHaveLength(0);
  });

  it('coordinates durable workflow completion with stale and duplicate protection', async () => {
    const draft = await workflows.create(principal, { branchId, type: WorkflowType.PROPERTY_SALE, payloadSchemaVersion: 1, payload: {} });
    let version = draft.version;
    for (let step = 2; step <= 8; step += 1) {
      const updated = await workflows.update(principal, draft.id, { expectedVersion: version, currentStep: step, payload: { propertyId, serviceEngagementId: engagementId, readinessNotes: 'Verified company-owned sale readiness.' } });
      version = updated.version;
    }
    const key = randomUUID();
    const completed = await workflows.complete(principal, draft.id, { expectedVersion: version, idempotencyKey: key });
    const replay = await workflows.complete(principal, draft.id, { expectedVersion: version, idempotencyKey: key });
    expect(replay).toEqual(completed);
    expect(await database.workflowCompletion.count({ where: { workflowId: draft.id } })).toBe(1);
    expect(await database.auditLog.count({ where: { entityId: draft.id, action: 'workflow.completed' } })).toBe(1);
  });

  it('progresses Viewings and Applications with encrypted screening evidence', async () => {
    const viewing = await leasing.createViewing(principal, { leadId, rentalListingId: publishedListingIds[0]!, assignedEmployeeId: employeeId, scheduledAt: '2026-09-10T09:00:00.000Z' });
    const confirmed = await leasing.completeViewing(principal, viewing.id, { expectedVersion: viewing.version, status: ViewingStatus.CONFIRMED, reason: 'Confirmed with applicant' });
    const completed = await leasing.completeViewing(principal, viewing.id, { expectedVersion: confirmed.version, status: ViewingStatus.COMPLETED, reason: 'Viewing held', outcome: 'Applicant wishes to proceed' });
    expect(completed.status).toBe(ViewingStatus.COMPLETED);
    const application = await leasing.createApplication(principal, { leadId, rentalListingId: publishedListingIds[0]!, applicantPartyId });
    const submitted = await leasing.transitionApplication(principal, application.id, { expectedVersion: application.version, status: ApplicationStatus.SUBMITTED, reason: 'Applicant submitted' });
    const reviewing = await leasing.transitionApplication(principal, application.id, { expectedVersion: submitted.version, status: ApplicationStatus.UNDER_REVIEW, reason: 'Review started' });
    const screening = await leasing.recordScreening(principal, application.id, { expectedVersion: reviewing.version, screeningStatus: ScreeningStatus.IN_PROGRESS, reason: 'Screening started', summary: 'Sensitive source evidence' });
    expect(screening).not.toHaveProperty('screeningSummaryEncrypted');
    const passed = await leasing.recordScreening(principal, application.id, { expectedVersion: screening.version, screeningStatus: ScreeningStatus.PASSED, reason: 'Checks complete', summary: 'Approved evidence' });
    const approved = await leasing.transitionApplication(principal, application.id, { expectedVersion: passed.version, status: ApplicationStatus.APPROVED, reason: 'Application approved' });
    expect(approved.status).toBe(ApplicationStatus.APPROVED);
  });

  it('prevents concurrent Reservations and reuses canonical Party for Tenant', async () => {
    const application = await database.rentalApplication.findFirstOrThrow({ where: { leadId, rentalListingId: publishedListingIds[0]! } });
    const attempts = await Promise.allSettled([0, 1].map(() => leasing.createReservation(principal, { applicationId: application.id, startsAt: '2026-09-04T00:00:00.000Z', expiresAt: '2026-09-08T00:00:00.000Z' })));
    expect(attempts.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const first = await leasing.convertTenant(principal, { applicationId: application.id });
    const replay = await leasing.convertTenant(principal, { applicationId: application.id });
    expect(replay.partyId).toBe(first.partyId); expect(first.partyId).toBe(applicantPartyId);
  });

  it('serializes overlapping Lease activation and preserves renewal history through Move-In', async () => {
    const createApprovedApplication = async () => {
      const row = await leasing.createApplication(principal, { leadId: secondLeadId, rentalListingId: publishedListingIds[0]!, applicantPartyId });
      const submitted = await leasing.transitionApplication(principal, row.id, { expectedVersion: row.version, status: ApplicationStatus.SUBMITTED, reason: 'Submitted' });
      const reviewing = await leasing.transitionApplication(principal, row.id, { expectedVersion: submitted.version, status: ApplicationStatus.UNDER_REVIEW, reason: 'Reviewing' });
      const screening = await leasing.recordScreening(principal, row.id, { expectedVersion: reviewing.version, screeningStatus: ScreeningStatus.WAIVED, reason: 'Approved waiver' });
      return leasing.transitionApplication(principal, row.id, { expectedVersion: screening.version, status: ApplicationStatus.APPROVED, reason: 'Approved' });
    };
    const firstApplication = await database.rentalApplication.findFirstOrThrow({ where: { leadId, rentalListingId: publishedListingIds[0]! } });
    const secondApplication = await createApprovedApplication();
    const tenant = await database.tenantProfile.findUniqueOrThrow({ where: { partyId: applicantPartyId } });
    const makeSignedLease = async (applicationId: string) => {
      let lease = await leasing.createLease(principal, { applicationId, serviceEngagementId: engagementId, leaseStartDate: '2026-09-04', leaseEndDate: '2027-09-04', rentAmount: '1200', currency: 'USD', parties: [{ partyId: tenant.partyId, role: LeasePartyRole.TENANT }, { partyId: companyPartyId, role: LeasePartyRole.LANDLORD }] });
      for (const status of [LeaseStatus.PENDING_APPROVAL, LeaseStatus.APPROVED, LeaseStatus.PENDING_SIGNATURE, LeaseStatus.SIGNED]) lease = await leasing.transitionLease(principal, lease.id, { expectedVersion: lease.version, status, reason: `Move to ${status}`, ...(status === LeaseStatus.SIGNED ? { signatureHash: randomUUID() } : {}) });
      return lease;
    };
    const [firstLease, secondLease] = await Promise.all([makeSignedLease(firstApplication.id), makeSignedLease(secondApplication.id)]);
    const activation = await Promise.allSettled([firstLease, secondLease].map((lease) => leasing.transitionLease(principal, lease.id, { expectedVersion: lease.version, status: LeaseStatus.ACTIVE, reason: 'Activate possession' })));
    expect(activation.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(activation.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const active = activation.find((result): result is PromiseFulfilledResult<Awaited<ReturnType<LeasingService['transitionLease']>>> => result.status === 'fulfilled')!.value;
    activeLeaseId = active.id;
    let renewal = await leasing.createRenewal(principal, { originalLeaseId: activeLeaseId, proposedStartDate: '2027-09-04', proposedEndDate: '2028-09-04', proposedRent: '1300', currency: 'USD' });
    for (const status of [RenewalStatus.PROPOSED, RenewalStatus.APPROVED, RenewalStatus.SIGNED, RenewalStatus.ACTIVATED]) renewal = await leasing.transitionRenewal(principal, renewal.id, { expectedVersion: renewal.version, status, reason: `Move to ${status}` });
    expect(renewal.successorLeaseId).toBeTruthy();
    expect((await database.lease.findUniqueOrThrow({ where: { id: activeLeaseId } })).status).toBe(LeaseStatus.ACTIVE);
    const moveIn = await leasing.scheduleMoveIn(principal, { leaseId: activeLeaseId, scheduledDate: '2026-09-05', notes: 'Keys and handover' });
    const completed = await leasing.transitionMoveIn(principal, moveIn.id, { expectedVersion: moveIn.version, status: MoveInStatus.COMPLETED, reason: 'Handover complete', completedDate: '2026-09-05' });
    expect(completed.status).toBe(MoveInStatus.COMPLETED);
  }, 60_000);
});
