import { BadRequestException } from '@nestjs/common';
import type { ApiEnvironment } from '@rerms/config';
import { BranchAccessMode } from '@prisma/client';
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
});
