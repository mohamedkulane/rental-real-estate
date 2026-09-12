import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  ConstructionContractStatus,
  ConstructionEconomicModel,
  DevelopmentPlotStatus,
} from '@prisma/client';

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
