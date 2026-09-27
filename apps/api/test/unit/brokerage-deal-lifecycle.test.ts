import { BrokerageDealStatus, Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { BrokerageDealService } from '../../src/finance/brokerage-deal.service';

function serviceFor(current: Record<string, unknown>) {
  const findFirst = vi.fn().mockResolvedValue(current);
  const service = new BrokerageDealService(
    { brokerageDeal: { findFirst } } as never,
    { assertBranchPermission: vi.fn() } as never,
    {} as never,
    {} as never,
  );
  return { service, findFirst };
}

describe('brokerage deal close guard', () => {
  it('rejects close while a commission receivable is outstanding', async () => {
    const { service } = serviceFor({
      id: 'deal-1',
      companyId: 'company-1',
      branchId: 'branch-1',
      leaseId: 'lease-1',
      status: BrokerageDealStatus.CONFIRMED,
      charges: [{ outstandingAmount: new Prisma.Decimal('35') }],
    });

    await expect(
      service.transition(
        { companyId: 'company-1' } as never,
        'deal-1',
        { status: BrokerageDealStatus.CLOSED, reason: 'Placement completed' },
      ),
    ).rejects.toThrow(
      'Owner and tenant commissions must be fully collected before closing the brokerage deal.',
    );
  });

  it('still requires an automatically linked lease before close', async () => {
    const { service } = serviceFor({
      id: 'deal-1',
      companyId: 'company-1',
      branchId: 'branch-1',
      leaseId: null,
      status: BrokerageDealStatus.CONFIRMED,
      charges: [{ outstandingAmount: new Prisma.Decimal('0') }],
    });

    await expect(
      service.transition(
        { companyId: 'company-1' } as never,
        'deal-1',
        { status: BrokerageDealStatus.CLOSED, reason: 'Placement completed' },
      ),
    ).rejects.toThrow('A linked lease is required before closing a brokerage deal.');
  });
});
