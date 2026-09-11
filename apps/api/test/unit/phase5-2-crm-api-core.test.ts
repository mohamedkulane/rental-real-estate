import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { BranchAccessMode, LeadIntent, LeadRentPeriod } from '@prisma/client';
import type { ApiEnvironment } from '@rerms/config';
import { describe, expect, it, vi } from 'vitest';
import { CrmContactService } from '../../src/crm/crm-contact.service';
import { CrmCursorService } from '../../src/crm/crm-cursor.service';
import { qualified, validatePreference } from '../../src/crm/crm-lead.service';
import { CrmSupportService } from '../../src/crm/crm-support.service';
import { CrmOperationsService } from '../../src/crm/crm-operations.service';
import type { AuthenticatedPrincipal } from '../../src/security/security.types';

const environment = {
  PARTY_DATA_ENCRYPTION_KEY_VERSION: 'v1',
  PARTY_DATA_ENCRYPTION_KEY: '11'.repeat(32),
  PARTY_DATA_DECRYPTION_KEYS: '',
  PARTY_CONTACT_LOOKUP_KEY: '22'.repeat(32),
} as ApiEnvironment;

function principal(): AuthenticatedPrincipal {
  return {
    userId: 'u',
    sessionId: 's',
    employeeId: 'e',
    companyId: 'c',
    businessDate: '2026-08-31',
    accessMode: BranchAccessMode.MULTI_BRANCH,
    roles: [],
    branchIds: new Set(['a', 'b']),
    permissions: new Set(['crm.lead.read', 'crm.followup.read']),
    permissionBranchScopes: new Map([
      ['crm.lead.read', new Set(['a', 'b'])],
      ['crm.followup.read', new Set(['b'])],
    ]),
  };
}

describe('Phase 5.2 CRM API core', () => {
  it('encrypts contacts, uses stable normalized HMAC tokens, and reveals only masked values by default', () => {
    const service = new CrmContactService(environment);
    const encrypted = service.encrypt('Buyer@Example.COM');
    expect(encrypted).not.toContain('Buyer');
    expect(service.decrypt(encrypted)).toBe('Buyer@Example.COM');
    expect(service.token(' Buyer@Example.COM ')).toBe(service.token('buyer@example.com'));
    expect(service.masked(encrypted, 'email')).toBe('B***@Example.COM');
  });

  it('uses encrypted filter-bound cursors and rejects tamper or cross-lane replay', () => {
    const service = new CrmCursorService(environment);
    const scope = service.scope({ companyId: 'c', stage: ['NEW'], branches: ['b', 'a'] });
    const cursor = service.encode('pipeline:NEW', scope, [
      '2026-08-31T00:00:00.000000Z',
      '01912345-0000-7000-8000-000000000000',
    ]);
    expect(cursor).not.toContain('01912345');
    expect(service.decode(cursor, 'pipeline:NEW', scope)?.key).toHaveLength(2);
    expect(() => service.decode(cursor, 'pipeline:QUALIFIED', scope)).toThrow(BadRequestException);
    expect(() => service.decode(`${cursor.slice(0, -1)}x`, 'pipeline:NEW', scope)).toThrow(
      BadRequestException,
    );
  });

  it('intersects every child-read permission scope and rejects a missing dimension', () => {
    const authorization = {
      authorizedBranchIds: vi.fn((_p: unknown, permission: string) =>
        permission === 'crm.lead.read' ? new Set(['a', 'b']) : new Set(['b']),
      ),
      assertBranchPermission: vi.fn(),
      assertCompanyPermission: vi.fn(),
    };
    const support = new CrmSupportService({} as never, authorization as never, {} as never);
    expect(support.branches(principal(), ['crm.lead.read', 'crm.followup.read'])).toEqual(['b']);
    expect(
      support.branches({ ...principal(), permissions: new Set(['crm.lead.read']) }, [
        'crm.lead.read',
        'crm.followup.read',
      ]),
    ).toEqual([]);
    expect(() =>
      support.assert({ ...principal(), permissions: new Set() }, 'crm.lead.read', 'a'),
    ).toThrow(ForbiddenException);
  });

  it('enforces discriminated preference ranges, required currency/area unit, and qualification gates', () => {
    expect(() =>
      validatePreference(LeadIntent.RENT, { minRent: '900', maxRent: '800', currency: 'USD' }),
    ).toThrow(BadRequestException);
    expect(() => validatePreference(LeadIntent.BUY, { maxBudget: '1000' })).toThrow(
      BadRequestException,
    );
    expect(() => validatePreference(LeadIntent.SELL, { rentPeriod: 'MONTHLY' } as never)).toThrow(
      BadRequestException,
    );
    const rent = {
      preferredAreaText: ['Westlands'],
      maxRent: '1000',
      currency: 'USD',
      rentPeriod: LeadRentPeriod.MONTHLY,
      moveInDate: '2026-09-01',
    };
    expect(() => validatePreference(LeadIntent.RENT, rent)).not.toThrow();
    expect(qualified(LeadIntent.RENT, rent)).toBe(true);
    expect(
      qualified(LeadIntent.CONSTRUCTION_SERVICE, {
        projectBrief: 'House',
        siteLocation: 'Nairobi',
        estimatedMaxBudget: '1',
        currency: 'USD',
      }),
    ).toBe(false);
  });

  it('rejects closing the last OPEN Follow-up of a NURTURING Lead', async () => {
    const transaction = vi.fn((fn: (tx: unknown) => unknown) => fn(tx));
    const tx = {
      leadFollowUp: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({ id: 'target', leadId: 'lead', state: 'OPEN', version: 1 })
          .mockResolvedValueOnce(null),
      },
    };
    const support = {
      database: { $transaction: transaction },
      lockedLead: vi
        .fn()
        .mockResolvedValue({
          id: 'lead',
          companyId: 'c',
          responsibleBranchId: 'b',
          stage: 'NURTURING',
        }),
    };
    const operations = new CrmOperationsService(support as never);
    await expect(
      operations.outcome(principal(), 'lead', 'target', 'CANCELLED', {
        expectedVersion: 1,
        reason: 'replace task',
      }),
    ).rejects.toThrow('CRM_QUALIFICATION_REQUIRED');
    expect(tx.leadFollowUp.findFirst).toHaveBeenLastCalledWith({
      where: {
        leadId: 'lead',
        lead: { companyId: 'c' },
        state: 'OPEN',
        id: { not: 'target' },
      },
      select: { id: true },
    });
  });

  it('accepts another same-company/same-lead OPEN task throughout the outcome', async () => {
    const tx = {
      leadFollowUp: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({ id: 'target', leadId: 'lead', state: 'OPEN', version: 1 })
          .mockResolvedValueOnce({ id: 'successor' }),
        update: vi.fn().mockResolvedValue({ id: 'target', version: 2, state: 'CANCELLED' }),
      },
      leadFollowUpOutcome: { create: vi.fn() },
    };
    const support = {
      database: { $transaction: vi.fn((fn: (value: typeof tx) => unknown) => fn(tx)) },
      lockedLead: vi
        .fn()
        .mockResolvedValue({
          id: 'lead',
          companyId: 'c',
          responsibleBranchId: 'b',
          stage: 'NURTURING',
        }),
      instant: vi.fn().mockResolvedValue(new Date()),
      audit: vi.fn(),
    };
    const result = await new CrmOperationsService(support as never).outcome(
      principal(),
      'lead',
      'target',
      'CANCELLED',
      { expectedVersion: 1, reason: 'replace task' },
    );
    expect(result).toEqual({ id: 'target', version: 2 });
    expect(tx.leadFollowUp.update).toHaveBeenCalledOnce();
    expect(tx.leadFollowUpOutcome.create).toHaveBeenCalledOnce();
  });
});
