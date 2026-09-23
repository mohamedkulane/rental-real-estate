import { AreaUnit, BranchAccessMode } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { RentalOrchestrationService } from '../../src/rental/rental-orchestration.service';
import type { AuthenticatedPrincipal } from '../../src/security/security.types';

const principal: AuthenticatedPrincipal = {
  companyId: 'company-id',
  userId: 'user-id',
  employeeId: 'employee-id',
  sessionId: 'session-id',
  businessDate: '2026-09-22',
  accessMode: BranchAccessMode.BRANCH,
  branchIds: new Set(['branch-id']),
  roles: [],
  permissions: new Set(),
  permissionBranchScopes: new Map(),
};

type RentPreferenceCreate = { minArea?: Prisma.Decimal; areaUnit?: AreaUnit };

function createService() {
  const rentCreates: RentPreferenceCreate[] = [];
  const preferenceCreate = vi.fn((input: { data: { rent: { create: RentPreferenceCreate } } }) => {
    rentCreates.push(input.data.rent.create);
    return Promise.resolve({ id: 'preference-id' });
  });
  const transaction = {
    $queryRaw: vi.fn().mockResolvedValue([{ value: 1n }]),
    lead: {
      create: vi.fn().mockResolvedValue({
        id: 'lead-id',
        leadNumber: 'LEAD-000001',
        displayName: 'Area Preference Customer',
      }),
    },
    leadPreferenceVersion: { create: preferenceCreate },
    leadStageHistory: { create: vi.fn().mockResolvedValue({}) },
    leadIntentHistory: { create: vi.fn().mockResolvedValue({}) },
    leadBranchHistory: { create: vi.fn().mockResolvedValue({}) },
  };
  const db = {
    leadSource: { findFirst: vi.fn().mockResolvedValue({ id: 'walk-in-source-id' }) },
    $transaction: vi.fn(async (callback: (tx: typeof transaction) => Promise<unknown>) =>
      callback(transaction),
    ),
  };
  const auth = { assertBranchPermission: vi.fn() };
  const audit = { write: vi.fn().mockResolvedValue(undefined) };
  const parties = { create: vi.fn().mockResolvedValue({ id: 'party-id' }) };
  const contacts = {
    encrypt: vi.fn((value: string) => value),
    token: vi.fn((value: string) => value),
  };
  const service = new RentalOrchestrationService(
    db as never,
    auth as never,
    audit as never,
    {} as never,
    parties as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    contacts as never,
  );
  return { service, rentCreates };
}

const baseInput = {
  name: 'Area Preference Customer',
  phone: '+252612345678',
  propertyTypeWanted: 'Apartment',
  preferredLocations: ['Hodan'],
  minRentBudget: '200',
  maxRentBudget: '400',
  branchId: 'branch-id',
};

describe('rental customer area preference', () => {
  it('keeps area optional', async () => {
    const { service, rentCreates } = createService();

    await service.addRentalCustomer(principal, baseInput);

    const rent = rentCreates[0]!;
    expect(rent.minArea).toBeUndefined();
    expect(rent.areaUnit).toBeUndefined();
  });

  it('stores a supplied area as square metres', async () => {
    const { service, rentCreates } = createService();

    await service.addRentalCustomer(principal, { ...baseInput, minArea: '130' });

    const rent = rentCreates[0]!;
    expect(rent.minArea?.toString()).toBe('130');
    expect(rent.areaUnit).toBe(AreaUnit.SQM);
  });
});
