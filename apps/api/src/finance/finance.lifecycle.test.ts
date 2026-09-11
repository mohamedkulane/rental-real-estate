import { BrokerageDealStatus, PayoutStatus, SaleOfferStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  brokerageDealTransitions,
  payoutTransitions,
  saleOfferTransitions,
} from './finance.policy';

describe('finance lifecycle policies', () => {
  it('closes brokerage deals only after confirmation', () => {
    expect(brokerageDealTransitions[BrokerageDealStatus.CONFIRMED]).toContain(
      BrokerageDealStatus.CLOSED,
    );
    expect(brokerageDealTransitions[BrokerageDealStatus.DRAFT]).not.toContain(
      BrokerageDealStatus.CLOSED,
    );
  });

  it('requires review before owner payout approval', () => {
    expect(payoutTransitions[PayoutStatus.DRAFT]).toEqual([
      PayoutStatus.REVIEW,
      PayoutStatus.CANCELLED,
    ]);
    expect(payoutTransitions[PayoutStatus.REVIEW]).toContain(PayoutStatus.APPROVED);
  });

  it('requires submission before accepting a sale offer', () => {
    expect(saleOfferTransitions[SaleOfferStatus.DRAFT]).toContain(SaleOfferStatus.SUBMITTED);
    expect(saleOfferTransitions[SaleOfferStatus.DRAFT]).not.toContain(SaleOfferStatus.ACCEPTED);
    expect(saleOfferTransitions[SaleOfferStatus.SUBMITTED]).toContain(SaleOfferStatus.ACCEPTED);
  });
});
