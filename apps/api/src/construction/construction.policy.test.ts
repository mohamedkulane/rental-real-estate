import { ConstructionContractStatus, ConstructionEconomicModel, DevelopmentPlotStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  assertConfigurablePaymentTerms,
  assertConstructionEconomicModel,
  assertInvoiceWithinContractCeiling,
  assertSaleablePlotHasProperty,
  constructionContractTransitions,
  remainingBillableContractValue,
} from './construction.policy';

describe('construction economic models', () => {
  it('keeps client construction separate from company development', () => {
    expect(() =>
      assertConstructionEconomicModel({
        economicModel: ConstructionEconomicModel.CONSTRUCTION_FOR_CLIENT,
        clientPartyId: 'client-1',
      }),
    ).not.toThrow();
    expect(() =>
      assertConstructionEconomicModel({
        economicModel: ConstructionEconomicModel.CONSTRUCTION_FOR_CLIENT,
      }),
    ).toThrow('Client construction requires a client party.');
    expect(() =>
      assertConstructionEconomicModel({
        economicModel: ConstructionEconomicModel.CONSTRUCTION_FOR_CLIENT,
        clientPartyId: 'client-1',
        developmentProjectId: 'dev-1',
      }),
    ).toThrow('Client construction cannot be linked to a company development project.');
    expect(() =>
      assertConstructionEconomicModel({
        economicModel: ConstructionEconomicModel.COMPANY_DEVELOPMENT,
      }),
    ).toThrow('Company development construction must link a development project.');
  });
});

describe('construction payment terms', () => {
  it('requires configurable installments and does not assume a 40% deposit', () => {
    expect(() => assertConfigurablePaymentTerms([])).toThrow('configurable payment term');
    expect(() =>
      assertConfigurablePaymentTerms([{ label: 'Deposit', percent: '25' } as never]),
    ).not.toThrow();
    expect(() => assertConfigurablePaymentTerms([{ percent: '140' }])).toThrow(
      'Payment term percents must be between 0 and 100.',
    );
  });
});

describe('construction contract billing ceiling', () => {
  it('allows an invoice below remaining contract value', () => {
    const remaining = remainingBillableContractValue({
      contractValue: '10000.00',
      invoicedAmount: '2500.00',
    });
    expect(remaining.equals(7500)).toBe(true);
    expect(() => assertInvoiceWithinContractCeiling({ amount: '7499.99', remaining })).not.toThrow();
  });

  it('allows an invoice exactly equal to remaining contract value', () => {
    const remaining = remainingBillableContractValue({
      contractValue: '10000.00',
      invoicedAmount: '4000.00',
    });
    expect(() => assertInvoiceWithinContractCeiling({ amount: '6000.00', remaining })).not.toThrow();
  });

  it('blocks an invoice that exceeds remaining contract value', () => {
    const remaining = remainingBillableContractValue({
      contractValue: '10000.00',
      invoicedAmount: '9000.00',
    });
    expect(() => assertInvoiceWithinContractCeiling({ amount: '1000.01', remaining })).toThrow(
      /exceeds remaining contract value/u,
    );
  });

  it('keeps approved variation amount as an unused extension point', () => {
    const remaining = remainingBillableContractValue({
      contractValue: '10000.00',
      invoicedAmount: '10000.00',
      approvedVariationAmount: '500.00',
    });
    expect(remaining.toString()).toBe('500');
  });
});

describe('development plot conversion', () => {
  it('blocks sale-ready status until a canonical Property exists', () => {
    expect(() => assertSaleablePlotHasProperty(DevelopmentPlotStatus.SALE_READY, false)).toThrow(
      'canonical Property',
    );
    expect(() => assertSaleablePlotHasProperty(DevelopmentPlotStatus.SALE_READY, true)).not.toThrow();
    expect(constructionContractTransitions[ConstructionContractStatus.DRAFT]).toContain(
      ConstructionContractStatus.ACTIVE,
    );
  });
});
