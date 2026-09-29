import { BadRequestException } from '@nestjs/common';
import type { ApiEnvironment } from '@rerms/config';
import { BranchAccessMode, RentableSpaceStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../../src/database/database.service';
import type { AuditService } from '../../src/governance/audit.service';
import { PartyCryptoService } from '../../src/portfolio/party-crypto.service';
import { PartyService } from '../../src/portfolio/party.service';
import { PortfolioService } from '../../src/portfolio/portfolio.service';
import type { AuthorizationService } from '../../src/security/authorization.service';
import type { AuthenticatedPrincipal } from '../../src/security/security.types';

const principal: AuthenticatedPrincipal = {
  userId: '00000000-0000-4000-8000-000000000001',
  employeeId: '00000000-0000-4000-8000-000000000002',
  companyId: '00000000-0000-4000-8000-000000000003',
  businessDate: '2026-08-16',
  sessionId: '00000000-0000-4000-8000-000000000004',
  accessMode: BranchAccessMode.COMPANY_WIDE,
  roles: [],
  permissions: new Set(['portfolio.space.create', 'portfolio.space.partition']),
  branchIds: new Set(),
  permissionBranchScopes: new Map([
    ['portfolio.space.create', new Set([null])],
    ['portfolio.space.partition', new Set([null])],
  ]),
};

const emptySpaceDependencyCounts = {
  childRelations: 0,
  parentRelations: 0,
  space_successors_space_successors_predecessorSpaceIdTorentable_spaces: 0,
  space_successors_space_successors_successorSpaceIdTorentable_spaces: 0,
  serviceEngagements: 0,
  rentLeadPreferences: 0,
  rentalListings: 0,
  reservations: 0,
  leases: 0,
  leasePossessions: 0,
  rentalApplications: 0,
  charges: 0,
  expenses: 0,
  journalLines: 0,
  brokerageDeals: 0,
  rentalAgreements: 0,
  maintenanceRequests: 0,
  workOrders: 0,
  inspections: 0,
  viewings: 0,
  defectIssues: 0,
};

describe('Phase 4 portfolio services', () => {
  it('encrypts contact values with authenticated encryption and stable normalization', () => {
    const crypto = new PartyCryptoService({
      PARTY_DATA_ENCRYPTION_KEY: '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
      PARTY_DATA_ENCRYPTION_KEY_VERSION: 'v1',
      PARTY_DATA_DECRYPTION_KEYS: '',
      PARTY_CONTACT_LOOKUP_KEY: '101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f',
    } as unknown as ApiEnvironment);
    const encrypted = crypto.encrypt('+252 61 123 4567');
    expect(encrypted).not.toContain('+252 61 123 4567');
    expect(encrypted.split('.')).toHaveLength(4);
    expect(crypto.decrypt(encrypted)).toBe('+252 61 123 4567');
    expect(crypto.normalizedHash(' Owner@Example.Test ')).toBe(
      crypto.normalizedHash('owner@example.test'),
    );
    expect(() => crypto.decrypt(`${encrypted}tampered`)).toThrow();
  });

  it('excludes employee identities from the business-party directory query', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new PartyService(
      { party: { findMany } } as unknown as DatabaseService,
      { today: vi.fn().mockResolvedValue(new Date('2026-08-16T00:00:00.000Z')) } as never,
      {} as PartyCryptoService,
      {} as AuditService,
      {
        authorizedBranchIds: vi.fn().mockReturnValue(null),
      } as unknown as AuthorizationService,
    );

    await service.list(principal, { limit: 25 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            expect.objectContaining({
              companyId: principal.companyId,
              employee: { is: null },
            }),
          ],
        },
        take: 26,
      }),
    );
  });

  it('rejects converting an employee identity into an owner profile', async () => {
    const transaction = vi.fn();
    const service = new PartyService(
      {
        party: {
          findFirst: vi.fn().mockResolvedValue({
            employee: { id: '00000000-0000-4000-8000-000000000099' },
          }),
        },
        $transaction: transaction,
      } as unknown as DatabaseService,
      { today: vi.fn().mockResolvedValue(new Date('2026-08-16T00:00:00.000Z')) } as never,
      {} as PartyCryptoService,
      {} as AuditService,
      {} as AuthorizationService,
    );

    await expect(
      service.createOwner(principal, {
        partyId: '00000000-0000-4000-8000-000000000099',
      }),
    ).rejects.toThrow(
      'Employees are staff identities and cannot be used as business parties or owners.',
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it('lists aggregate documents with company isolation and batched related-record enrichment', async () => {
    const documentFindMany = vi.fn().mockResolvedValue([
      {
        id: '00000000-0000-4000-8000-000000000101',
        companyId: principal.companyId,
        displayName: 'Document one',
        categoryCode: 'TITLE',
        accessClass: 'INTERNAL',
        status: 'ACTIVE',
        createdAt: new Date('2026-01-02'),
        versions: [{ sizeBytes: BigInt(100) }],
        links: [{ entityType: 'Property', entityId: '00000000-0000-4000-8000-000000000201' }],
      },
      {
        id: '00000000-0000-4000-8000-000000000102',
        companyId: principal.companyId,
        displayName: 'Document two',
        categoryCode: 'TITLE',
        accessClass: 'INTERNAL',
        status: 'ACTIVE',
        createdAt: new Date('2026-01-01'),
        versions: [{ sizeBytes: BigInt(200) }],
        links: [{ entityType: 'Property', entityId: '00000000-0000-4000-8000-000000000202' }],
      },
    ]);
    const propertyFindMany = vi.fn().mockResolvedValue([
      { id: '00000000-0000-4000-8000-000000000201', propertyCode: 'P-1', name: 'One' },
      { id: '00000000-0000-4000-8000-000000000202', propertyCode: 'P-2', name: 'Two' },
    ]);
    const service = new PortfolioService(
      {
        document: { findMany: documentFindMany },
        property: { findMany: propertyFindMany },
        ownerProfile: { findMany: vi.fn() },
        rentableSpace: { findMany: vi.fn() },
      } as unknown as DatabaseService,
      { today: vi.fn().mockResolvedValue(new Date('2026-08-16')) } as never,
      {} as never,
      { authorizedBranchIds: vi.fn().mockReturnValue(null) } as unknown as AuthorizationService,
      {} as AuditService,
      {} as never,
    );

    const result = await service.listDocuments(principal, {
      limit: 25,
      entityType: 'Property',
      categoryCode: 'title',
      accessClass: 'INTERNAL',
      status: 'ACTIVE',
    });

    expect(result.items).toHaveLength(2);
    expect(documentFindMany).toHaveBeenCalledTimes(1);
    expect(propertyFindMany).toHaveBeenCalledTimes(1);
    const documentQuery: unknown = documentFindMany.mock.calls[0]?.[0];
    expect(documentQuery).toMatchObject({
      where: {
        companyId: principal.companyId,
        categoryCode: { equals: 'title', mode: 'insensitive' },
        accessClass: 'INTERNAL',
        status: 'ACTIVE',
      },
      take: 26,
    });
  });

  it.each([
    ['BRANCH', new Set(['00000000-0000-4000-8000-000000000301'])],
    [
      'MULTI_BRANCH',
      new Set(['00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000302']),
    ],
  ])('scopes %s document aggregates to authorized entity ids', async (_mode, branchIds) => {
    const propertyFindMany = vi
      .fn()
      .mockResolvedValueOnce([{ id: '00000000-0000-4000-8000-000000000401' }])
      .mockResolvedValueOnce([]);
    const documentFindMany = vi.fn().mockResolvedValue([]);
    const service = new PortfolioService(
      {
        document: { findMany: documentFindMany },
        property: { findMany: propertyFindMany },
        ownerProfile: { findMany: vi.fn() },
        rentableSpace: { findMany: vi.fn() },
      } as unknown as DatabaseService,
      { today: vi.fn().mockResolvedValue(new Date('2026-08-16')) } as never,
      {} as never,
      {
        authorizedBranchIds: vi.fn().mockReturnValue(branchIds),
      } as unknown as AuthorizationService,
      {} as AuditService,
      {} as never,
    );

    await service.listDocuments(principal, { limit: 25, entityType: 'Property' });

    const propertyScopeQuery: unknown = propertyFindMany.mock.calls[0]?.[0];
    expect(propertyScopeQuery).toMatchObject({
      where: {
        companyId: principal.companyId,
        branchAssignments: { some: { branchId: { in: [...branchIds] } } },
      },
    });
    const scopedDocumentQuery: unknown = documentFindMany.mock.calls[0]?.[0];
    expect(scopedDocumentQuery).toMatchObject({
      where: {
        companyId: principal.companyId,
        links: {
          some: {
            entityType: 'Property',
            entityId: { in: ['00000000-0000-4000-8000-000000000401'] },
          },
        },
      },
    });
  });
  it('requires the area unit whenever space area is supplied', async () => {
    const service = new PortfolioService(
      {} as DatabaseService,
      { today: vi.fn().mockResolvedValue(new Date('2026-01-01')) } as never,
      {
        scheduledDate: vi
          .fn()
          .mockImplementation((_companyId, value) => Promise.resolve(new Date(value))),
      } as never,
      {} as AuthorizationService,
      {} as AuditService,
      {} as never,
    );
    await expect(
      service.createSpace(principal, {
        propertyId: '00000000-0000-4000-8000-000000000010',
        typeCode: 'ROOM',
        spaceCode: 'R-1',
        name: 'Room one',
        effectiveFrom: '2026-01-01',
        usableArea: '20',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires land-specific data and rejects profiles on other physical types', async () => {
    const service = new PortfolioService(
      {} as DatabaseService,
      { today: vi.fn().mockResolvedValue(new Date('2026-01-01')) } as never,
      {
        scheduledDate: vi
          .fn()
          .mockImplementation((_companyId, value) => Promise.resolve(new Date(value))),
      } as never,
      {} as AuthorizationService,
      {} as AuditService,
      {} as never,
    );
    await expect(
      service.createSpace(principal, {
        propertyId: '00000000-0000-4000-8000-000000000010',
        typeCode: 'LAND',
        spaceCode: 'L-1',
        name: 'Land one',
        effectiveFrom: '2026-01-01',
      }),
    ).rejects.toThrow('LAND requires land-specific data.');
    await expect(
      service.createSpace(principal, {
        propertyId: '00000000-0000-4000-8000-000000000010',
        typeCode: 'ROOM',
        spaceCode: 'R-2',
        name: 'Room two',
        effectiveFrom: '2026-01-01',
        land: { permittedUse: 'Agriculture' },
      }),
    ).rejects.toThrow('Land-specific data is valid only for LAND.');
  });

  it('rejects an aggregate child area above the effective parent usable area before writing', async () => {
    const transaction = vi.fn();
    const database = {
      rentableSpace: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: '00000000-0000-4000-8000-000000000020',
          propertyId: '00000000-0000-4000-8000-000000000010',
          versions: [
            {
              effectiveFrom: new Date('2026-01-01'),
              effectiveTo: null,
              usableArea: '100',
              areaUnit: 'SQM',
            },
          ],
        }),
      },
      propertyBranchAssignment: {
        findFirst: vi.fn().mockResolvedValue({ branchId: '00000000-0000-4000-8000-000000000030' }),
      },
      $transaction: transaction,
    } as unknown as DatabaseService;
    const authorization = {
      assertBranchPermission: vi.fn(),
    } as unknown as AuthorizationService;
    const service = new PortfolioService(
      database,
      { today: vi.fn().mockResolvedValue(new Date('2026-02-01')) } as never,
      {
        scheduledDate: vi
          .fn()
          .mockImplementation((_companyId, value) => Promise.resolve(new Date(value))),
      } as never,
      authorization,
      {} as AuditService,
      {} as never,
    );
    await expect(
      service.partition(principal, '00000000-0000-4000-8000-000000000020', {
        effectiveFrom: '2026-02-01',
        areaUnit: 'SQM',
        reason: 'Invalid area test',
        children: [
          { typeCode: 'ROOM', spaceCode: 'R-1', name: 'Room one', usableArea: '60' },
          { typeCode: 'ROOM', spaceCode: 'R-2', name: 'Room two', usableArea: '41' },
        ],
      }),
    ).rejects.toThrow('Child usable-area total cannot exceed parent usable area.');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('retires a removed unit when any business history exists', async () => {
    const space = {
      id: '00000000-0000-4000-8000-000000000501',
      propertyId: '00000000-0000-4000-8000-000000000502',
      spaceCode: 'SPC-0501',
      name: 'Apartment 1',
      status: RentableSpaceStatus.ACTIVE,
    };
    const rentableSpaceDelete = vi.fn();
    const transaction = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: space.id }]),
      rentableSpace: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          _count: { ...emptySpaceDependencyCounts, viewings: 1 },
        }),
        update: vi.fn().mockResolvedValue({ ...space, status: RentableSpaceStatus.RETIRED }),
        delete: rentableSpaceDelete,
      },
      documentLink: { count: vi.fn().mockResolvedValue(0) },
      rentableSpaceVersion: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      rentableSpaceParentHistory: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      lease: { count: vi.fn().mockResolvedValue(0) },
    };
    const auditWrite = vi.fn();
    const runTransaction = vi.fn((callback: (client: typeof transaction) => Promise<unknown>) =>
      callback(transaction),
    );
    const service = new PortfolioService(
      {
        rentableSpace: { findUniqueOrThrow: vi.fn().mockResolvedValue(space) },
        propertyBranchAssignment: {
          findFirst: vi.fn().mockResolvedValue({
            branchId: '00000000-0000-4000-8000-000000000503',
          }),
        },
        $transaction: runTransaction,
      } as unknown as DatabaseService,
      { today: vi.fn().mockResolvedValue(new Date('2026-08-16')) } as never,
      {
        scheduledDate: vi.fn().mockResolvedValue(new Date('2026-08-16')),
        assertNoLaterScheduledChange: vi.fn(),
      } as never,
      { assertBranchPermission: vi.fn() } as unknown as AuthorizationService,
      { write: auditWrite } as unknown as AuditService,
      {} as never,
    );

    const result = await service.removeSpace(principal, space.id, {
      effectiveDate: '2026-08-16',
      reason: 'Duplicate unit record',
    });

    expect(result).toMatchObject({
      outcome: 'RETIRED',
      spaceId: space.id,
      preservedHistory: ['viewing'],
    });
    expect(rentableSpaceDelete).not.toHaveBeenCalled();
    expect(transaction.rentableSpace.update).toHaveBeenCalledWith({
      where: { id: space.id },
      data: { status: RentableSpaceStatus.RETIRED },
    });
    expect(auditWrite).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({ action: 'portfolio.space.retired', entityId: space.id }),
    );
  });

  it('permanently deletes only an unused unit and its owned configuration', async () => {
    const space = {
      id: '00000000-0000-4000-8000-000000000511',
      propertyId: '00000000-0000-4000-8000-000000000512',
      spaceCode: 'SPC-0511',
      name: 'Erroneous unit',
      status: RentableSpaceStatus.ACTIVE,
    };
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const rentableSpaceDelete = vi.fn().mockResolvedValue(space);
    const transaction = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: space.id }]),
      rentableSpace: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ _count: emptySpaceDependencyCounts }),
        delete: rentableSpaceDelete,
      },
      documentLink: { count: vi.fn().mockResolvedValue(0) },
      spaceAmenity: { deleteMany },
      residentialSpaceProfile: { deleteMany },
      commercialSpaceProfile: { deleteMany },
      landSpaceProfile: { deleteMany },
      rentableSpaceVersion: { deleteMany },
    };
    const auditWrite = vi.fn();
    const runTransaction = vi.fn((callback: (client: typeof transaction) => Promise<unknown>) =>
      callback(transaction),
    );
    const service = new PortfolioService(
      {
        rentableSpace: { findUniqueOrThrow: vi.fn().mockResolvedValue(space) },
        propertyBranchAssignment: {
          findFirst: vi.fn().mockResolvedValue({
            branchId: '00000000-0000-4000-8000-000000000513',
          }),
        },
        $transaction: runTransaction,
      } as unknown as DatabaseService,
      { today: vi.fn().mockResolvedValue(new Date('2026-08-16')) } as never,
      { scheduledDate: vi.fn().mockResolvedValue(new Date('2026-08-16')) } as never,
      { assertBranchPermission: vi.fn() } as unknown as AuthorizationService,
      { write: auditWrite } as unknown as AuditService,
      {} as never,
    );

    const result = await service.removeSpace(principal, space.id, {
      effectiveDate: '2026-08-16',
      reason: 'Created in error',
    });

    expect(result).toEqual({ outcome: 'DELETED', spaceId: space.id, preservedHistory: [] });
    expect(rentableSpaceDelete).toHaveBeenCalledWith({ where: { id: space.id } });
    expect(auditWrite).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({
        action: 'portfolio.space.deleted-unused',
        entityId: space.id,
        reason: 'Created in error',
      }),
    );
  });
});
