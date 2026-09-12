import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  ConstructionContractStatus,
  ConstructionEconomicModel,
  DevelopmentPlotStatus,
  Prisma,
} from '@prisma/client';

const asDecimal = (value: Prisma.Decimal | string | number): Prisma.Decimal =>
  value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);

export function assertConstructionEconomicModel(input: {
  economicModel: ConstructionEconomicModel;
  clientPartyId?: string | null;
  developmentProjectId?: string | null;
}): void {
  if (input.economicModel === ConstructionEconomicModel.CONSTRUCTION_FOR_CLIENT) {
    if (!input.clientPartyId) {
      throw new BadRequestException('Client construction requires a client party.');
    }
    if (input.developmentProjectId) {
      throw new BadRequestException('Client construction cannot be linked to a company development project.');
    }
    return;
  }
  if (input.economicModel === ConstructionEconomicModel.COMPANY_DEVELOPMENT && !input.developmentProjectId) {
    throw new BadRequestException('Company development construction must link a development project.');
  }
}

export function assertConfigurablePaymentTerms(
  installments: ReadonlyArray<{ percent?: string | null; amount?: string | null }>,
): void {
  if (!installments.length) {
    throw new BadRequestException('Construction contracts require at least one configurable payment term.');
  }
  const percents = installments.map((row) => (row.percent ? Number(row.percent) : 0));
  if (percents.some((value) => Number.isNaN(value) || value < 0 || value > 100)) {
    throw new BadRequestException('Payment term percents must be between 0 and 100.');
  }
}

export const constructionContractTransitions: Record<
  ConstructionContractStatus,
  readonly ConstructionContractStatus[]
> = {
  DRAFT: [ConstructionContractStatus.ACTIVE, ConstructionContractStatus.CANCELLED],
  ACTIVE: [ConstructionContractStatus.COMPLETED, ConstructionContractStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};

export function remainingBillableContractValue(input: {
  contractValue: Prisma.Decimal | string | number;
  invoicedAmount: Prisma.Decimal | string | number;
  approvedVariationAmount?: Prisma.Decimal | string | number;
}): Prisma.Decimal {
  const contractValue = asDecimal(input.contractValue);
  const invoicedAmount = asDecimal(input.invoicedAmount);
  const approvedVariationAmount = asDecimal(input.approvedVariationAmount ?? 0);
  const remaining = contractValue.plus(approvedVariationAmount).minus(invoicedAmount);
  return remaining.lt(0) ? new Prisma.Decimal(0) : remaining;
}

export function assertInvoiceWithinContractCeiling(input: {
  amount: Prisma.Decimal | string | number;
  remaining: Prisma.Decimal | string | number;
}): void {
  const amount = asDecimal(input.amount);
  const remaining = asDecimal(input.remaining);
  if (amount.gt(remaining)) {
    throw new ConflictException(
      `Invoice amount ${amount.toFixed(4)} exceeds remaining contract value ${remaining.toFixed(4)}.`,
    );
  }
}

export function assertSaleablePlotHasProperty(
  status: DevelopmentPlotStatus,
  hasCanonicalProperty: boolean,
): void {
  if (
    (status === DevelopmentPlotStatus.SALE_READY || status === DevelopmentPlotStatus.SOLD) &&
    !hasCanonicalProperty
  ) {
    throw new ConflictException('A saleable plot must first convert to a canonical Property.');
  }
}
