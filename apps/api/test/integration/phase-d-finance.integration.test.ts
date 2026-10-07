import { randomUUID } from 'node:crypto';
import {
  AgreementCommissionMethod,
  BranchAccessMode,
  PaymentStatus,
  PrismaClient,
  ServiceModel,
  ViewingStatus,
} from '@prisma/client';
import { uuidv7 } from '@rerms/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FinanceOverviewService } from '../../src/finance/finance-overview.service';
import { FinanceSelectorsService } from '../../src/finance/finance-selectors.service';
import { PaymentService } from '../../src/finance/payment.service';
import { AuditService } from '../../src/governance/audit.service';
import { AgreementService } from '../../src/rental/agreement.service';
import { AuthorizationService } from '../../src/security/authorization.service';
import type { AuthenticatedPrincipal } from '../../src/security/security.types';

const url = process.env.PHASE5_TEST_DATABASE_URL;
const permissions = [
  'lease.create',
  'payment.create',
  'payment.allocate',
  'payment.read',
  'billing.read',
  'brokerage-deal.read',
  'finance.overview.read',
  'invoice.read',
  'payout.read',
  'expense.read',
  'journal.read',
];

describe.skipIf(!url)('Phase D finance and payment linkage', () => {
  let db: PrismaClient;
  let principal: AuthenticatedPrincipal;
  let agreements: AgreementService;
  let payments: PaymentService;
  let overview: FinanceOverviewService;
  let selectors: FinanceSelectorsService;
  let branchId: string;
  let ownerPartyId: string;
  let customerPartyId: string;
  let agreementId: string;
  let evcMethodId: string;
  const suffix = randomUUID().slice(0, 8).toUpperCase();

  beforeAll(async () => {
    if (!url || !/^\/rerms_phase5_[a-z0-9_]+$/u.test(new URL(url).pathname)) {
      throw new Error('Phase D tests require a dedicated rerms_phase5_* database.');
    }
    db = new PrismaClient({ datasourceUrl: url, transactionOptions: { timeout: 60_000 } });
    const company = await db.company.findFirstOrThrow();
    const branch = await db.branch.create({
      data: {
        id: uuidv7(),
        companyId: company.id,
        code: `PD-${suffix}`,
        name: `Phase D Branch ${suffix}`,
        active: true,
      },
    });
    const user = await db.user.findFirstOrThrow({ where: { employee: { companyId: company.id } } });
    const employee = await db.employee.findFirstOrThrow({ where: { userId: user.id } });
    const source = await db.leadSource.findFirstOrThrow({
      where: { companyId: company.id, status: 'ACTIVE' },
    });
    const spaceType = await db.rentableSpaceType.findFirstOrThrow({ where: { active: true } });
    branchId = branch.id;

    const makeParty = async (role: string) =>
      db.party.create({
        data: {
          id: uuidv7(),
          companyId: company.id,
          partyNumber: `PD-${role}-${suffix}`,
          kind: 'PERSON',
          displayName: `Phase D ${role} ${suffix}`,
          person: { create: { givenName: 'Phase D', familyName: `${role} ${suffix}` } },
          branchAssignments: {
            create: { id: uuidv7(), branchId, effectiveFrom: new Date('2026-01-01') },
          },
        },
      });
    const owner = await makeParty('Owner');
    const customer = await makeParty('Customer');
    ownerPartyId = owner.id;
    customerPartyId = customer.id;

    const property = await db.property.create({
      data: {
        id: uuidv7(),
        companyId: company.id,
        propertyCode: `PD-${suffix}`,
        name: `Phase D Property ${suffix}`,
        propertyType: 'APARTMENT_BUILDING',
        status: 'ACTIVE',
        city: 'Mogadishu',
        branchAssignments: {
          create: { id: uuidv7(), branchId, effectiveFrom: new Date('2026-01-01') },
        },
        ownerships: {
          create: {
            id: uuidv7(),
            ownerPartyId: owner.id,
            ownershipPercent: '100',
            effectiveFrom: new Date('2026-01-01'),
          },
        },
      },
    });
    const space = await db.rentableSpace.create({
      data: {
        id: uuidv7(),
        propertyId: property.id,
        typeId: spaceType.id,
        spaceCode: `PD-${suffix}-1`,
        name: 'Phase D Unit',
        status: 'ACTIVE',
      },
    });
    const engagement = await db.serviceEngagement.create({
      data: {
        id: uuidv7(),
        companyId: company.id,
        engagementNumber: `ENG-PD-${suffix}`,
        serviceModel: ServiceModel.RENTAL_BROKERAGE,
        status: 'ACTIVE',
        propertyId: property.id,
        effectiveFrom: new Date('2026-01-01'),
        createdByUserId: user.id,
      },
    });
    const lead = await db.lead.create({
      data: {
        id: uuidv7(),
        companyId: company.id,
        leadNumber: `LEAD-${Number.parseInt(suffix, 16)}`,
        intent: 'RENT',
        sourceId: source.id,
        responsibleBranchId: branch.id,
        partyId: customer.id,
        displayName: customer.displayName,
        createdByUserId: user.id,
        branchHistory: {
          create: {
            id: uuidv7(),
            branchId: branch.id,
            assignedFrom: new Date('2026-01-01'),
            actorUserId: user.id,
            reason: 'Phase D fixture',
          },
        },
        stageHistory: {
          create: {
            id: uuidv7(),
            toStage: 'NEW',
            actorUserId: user.id,
            leadVersion: 1,
            reason: 'Phase D fixture',
          },
        },
        intentHistory: {
          create: {
            id: uuidv7(),
            toIntent: 'RENT',
            actorUserId: user.id,
            leadVersion: 1,
            reason: 'Phase D fixture',
          },
        },
        preferenceVersions: {
          create: {
            id: uuidv7(),
            intent: 'RENT',
            versionNo: 1,
            effectiveFrom: new Date('2026-01-01'),
            actorUserId: user.id,
            rent: { create: { minRent: '500', maxRent: '1500', currency: 'USD' } },
          },
        },
      },
    });
    const viewing = await db.viewing.create({
      data: {
        id: uuidv7(),
        companyId: company.id,
        branchId: branch.id,
        leadId: lead.id,
        rentableSpaceId: space.id,
        assignedEmployeeId: employee.id,
        scheduledAt: new Date('2026-09-20T09:00:00.000Z'),
        status: ViewingStatus.COMPLETED,
        outcome: 'INTERESTED',
        createdByUserId: user.id,
      },
    });
    const agreement = await db.rentalAgreement.create({
      data: {
        id: uuidv7(),
        companyId: company.id,
        branchId: branch.id,
        agreementNumber: `RAG-PD-${suffix}`,
        leadId: lead.id,
        viewingId: viewing.id,
        propertyId: property.id,
        rentableSpaceId: space.id,
        serviceEngagementId: engagement.id,
        ownerPartyId: owner.id,
        customerPartyId: customer.id,
        originalAskingRent: '1000',
        finalRent: '1000',
        currency: 'USD',
        leaseStartDate: new Date('2026-10-01'),
        ownerCommissionMethod: AgreementCommissionMethod.FIXED,
        ownerCommissionValue: '100',
        tenantCommissionMethod: AgreementCommissionMethod.FIXED,
        tenantCommissionValue: '100',
        createdByUserId: user.id,
      },
    });
    agreementId = agreement.id;
    principal = {
      userId: user.id,
      employeeId: employee.id,
      sessionId: randomUUID(),
      companyId: company.id,
      businessDate: '2026-09-27',
      accessMode: BranchAccessMode.BRANCH,
      roles: [],
      permissions: new Set(permissions),
      permissionBranchScopes: new Map(
        permissions.map((permission) => [permission, new Set<string | null>([branch.id])]),
      ),
      branchIds: new Set([branch.id]),
    };
    const auth = new AuthorizationService();
    const audit = new AuditService();
    agreements = new AgreementService(db as never, auth, audit);
    payments = new PaymentService(db as never, auth, audit);
    overview = new FinanceOverviewService(db as never, auth);
    selectors = new FinanceSelectorsService(db as never, auth);
    evcMethodId = (
      await db.paymentMethod.findFirstOrThrow({ where: { companyId: company.id, code: 'EVC' } })
    ).id;
  }, 60_000);

  afterAll(async () => db?.$disconnect());

  it('creates owner and tenant commission receivables exactly once at agreement confirmation', async () => {
    await agreements.confirmRental(principal, agreementId, {
      expectedVersion: 1,
      reason: 'Terms accepted',
    });
    const deal = await db.brokerageDeal.findUniqueOrThrow({
      where: { rentalAgreementId: agreementId },
    });
    const charges = await db.charge.findMany({
      where: { brokerageDealId: deal.id },
      orderBy: { commissionSide: 'asc' },
    });
    expect(charges).toHaveLength(2);
    expect(charges.map((row) => [row.commissionSide, row.originalAmount.toString()])).toEqual([
      ['OWNER', '100'],
      ['TENANT', '100'],
    ]);
    await expect(
      agreements.confirmRental(principal, agreementId, { expectedVersion: 1, reason: 'Retry' }),
    ).rejects.toThrow('Only a draft agreement can be confirmed');
    expect(await db.charge.count({ where: { brokerageDealId: deal.id } })).toBe(2);
  });

  it('supports partial contextual payments and rejects overpayment', async () => {
    const ownerCharge = await db.charge.findFirstOrThrow({
      where: { brokerageDeal: { rentalAgreementId: agreementId }, commissionSide: 'OWNER' },
    });
    for (const amount of ['60', '40']) {
      await payments.create(principal, {
        branchId,
        payerPartyId: ownerPartyId,
        methodId: evcMethodId,
        chargeId: ownerCharge.id,
        currency: 'USD',
        amount,
        receivedAt: '2026-09-27T10:00:00.000Z',
        idempotencyKey: `PD-${suffix}-OWNER-${amount}`,
      });
    }
    const paid = await db.charge.findUniqueOrThrow({ where: { id: ownerCharge.id } });
    expect(paid.outstandingAmount.toString()).toBe('0');
    expect(paid.status).toBe('PAID');

    const tenantCharge = await db.charge.findFirstOrThrow({
      where: { brokerageDeal: { rentalAgreementId: agreementId }, commissionSide: 'TENANT' },
    });
    await expect(
      payments.create(principal, {
        branchId,
        payerPartyId: customerPartyId,
        methodId: evcMethodId,
        chargeId: tenantCharge.id,
        currency: 'USD',
        amount: '110',
        receivedAt: '2026-09-27T11:00:00.000Z',
      }),
    ).rejects.toThrow('cannot exceed the outstanding balance');
  });

  it('restores outstanding commission when a payment is reversed', async () => {
    const charge = await db.charge.findFirstOrThrow({
      where: { brokerageDeal: { rentalAgreementId: agreementId }, commissionSide: 'TENANT' },
    });
    const payment = await payments.create(principal, {
      branchId,
      payerPartyId: customerPartyId,
      methodId: evcMethodId,
      chargeId: charge.id,
      currency: 'USD',
      amount: '100',
      receivedAt: '2026-09-27T12:00:00.000Z',
      idempotencyKey: `PD-${suffix}-TENANT`,
    });
    await payments.reverse(principal, payment.id, { reason: 'Payment returned by provider' });
    const [restored, reversed, allocation] = await Promise.all([
      db.charge.findUniqueOrThrow({ where: { id: charge.id } }),
      db.payment.findUniqueOrThrow({ where: { id: payment.id } }),
      db.paymentAllocation.findFirstOrThrow({ where: { paymentId: payment.id } }),
    ]);
    expect(restored.outstandingAmount.toString()).toBe('100');
    expect(restored.status).toBe('OPEN');
    expect(reversed.status).toBe(PaymentStatus.REVERSED);
    expect(allocation.reversedAt).toBeTruthy();
  });

  it('reports earned, received, and outstanding separately from actual records', async () => {
    const result = await overview.overview(principal);
    expect(result.summary.brokerageCommissionEarned).toBe('200');
    expect(result.summary.brokerageCashReceived).toBe('100');
    expect(result.summary.brokerageOutstanding).toBe('100');
  });

  it('exposes only supported Somalia methods and enforces branch scope', async () => {
    const selectorPrincipal: AuthenticatedPrincipal = {
      ...principal,
      accessMode: BranchAccessMode.COMPANY_WIDE,
      permissionBranchScopes: new Map(
        permissions.map((permission) => [permission, new Set<string | null>([null])]),
      ),
    };
    const methods = await selectors.paymentMethods(selectorPrincipal, { limit: 25 });
    expect(methods.items.map((row) => row.code).sort()).toEqual([
      'EDAHAB',
      'EVC',
      'SALAAM_BANK',
      'SOMNET',
    ]);
    const charge = await db.charge.findFirstOrThrow({
      where: { brokerageDeal: { rentalAgreementId: agreementId }, commissionSide: 'TENANT' },
    });
    const denied = {
      ...principal,
      accessMode: BranchAccessMode.BRANCH,
      permissionBranchScopes: new Map(
        permissions.map((permission) => [permission, new Set<string | null>([randomUUID()])]),
      ),
    };
    await expect(
      payments.create(denied, {
        branchId,
        payerPartyId: customerPartyId,
        methodId: evcMethodId,
        chargeId: charge.id,
        currency: 'USD',
        amount: '10',
        receivedAt: '2026-09-27T13:00:00.000Z',
      }),
    ).rejects.toThrow();
  });

  it('resolves the receiving account from the selected payment method', async () => {
    const method = await db.paymentMethod.findUniqueOrThrow({ where: { id: evcMethodId } });
    expect(method.receivingAccountId).toBeTruthy();
    const payment = await payments.create(principal, {
      branchId,
      payerPartyId: customerPartyId,
      methodId: evcMethodId,
      currency: 'USD',
      amount: '25',
      receivedAt: '2026-09-27T14:00:00.000Z',
      purpose: 'GENERAL',
      idempotencyKey: `PD-${suffix}-GENERAL`,
    });
    expect(payment.receivingAccountId).toBe(method.receivingAccountId);
  });
});
