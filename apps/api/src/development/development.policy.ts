import { ConflictException } from '@nestjs/common';
import { DevelopmentPlotStatus } from '@prisma/client';

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
