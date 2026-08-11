import { BadRequestException } from '@nestjs/common';
import type { ApiEnvironment } from '@rerms/config';
import { BranchAccessMode } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../../src/database/database.service';
import type { AuditService } from '../../src/governance/audit.service';
import { PartyCryptoService } from '../../src/portfolio/party-crypto.service';
import { PortfolioService } from '../../src/portfolio/portfolio.service';
import type { AuthorizationService } from '../../src/security/authorization.service';
import type { AuthenticatedPrincipal } from '../../src/security/security.types';

const principal: AuthenticatedPrincipal = {
  userId: '00000000-0000-4000-8000-000000000001',
  employeeId: '00000000-0000-4000-8000-000000000002',
  companyId: '00000000-0000-4000-8000-000000000003',
  sessionId: '00000000-0000-4000-8000-000000000004',
  accessMode: BranchAccessMode.COMPANY_WIDE,
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
