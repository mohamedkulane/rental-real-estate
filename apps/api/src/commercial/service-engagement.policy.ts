import { BadRequestException, ConflictException } from '@nestjs/common';
import { ServiceEngagementStatus, ServiceModel } from '@prisma/client';

export const capabilityNames = [
  'canCreateRentalListing',
  'canCreateSaleListing',
  'canMarketRentalSpace',
  'canMarketPropertyForSale',
  'canReceiveRentalLead',
  'canReceiveBuyerLead',
  'canReceiveSellerLead',
  'canCreateViewing',
  'canAcceptApplication',
  'canReserveSpace',
  'canCreateLease',
  'canCollectRent',
  'canManageMaintenance',
] as const;

export type CapabilityName = (typeof capabilityNames)[number];
export type CapabilitySet = Record<CapabilityName, boolean>;
export type EngagementPeriod = 'CURRENT' | 'SCHEDULED' | 'HISTORICAL';

const saleCompatibleRentalModels = new Set<ServiceModel>([
  ServiceModel.RENTAL_BROKERAGE,
  ServiceModel.TENANT_PLACEMENT,
  ServiceModel.FULL_MANAGEMENT,
  ServiceModel.RENT_COLLECTION_ONLY,
  ServiceModel.MASTER_LEASE_SUBLEASE,
]);

const rentalScopedModels = new Set<ServiceModel>([
  ServiceModel.RENTAL_BROKERAGE,
  ServiceModel.TENANT_PLACEMENT,
  ServiceModel.FULL_MANAGEMENT,
  ServiceModel.RENT_COLLECTION_ONLY,
  ServiceModel.MASTER_LEASE_SUBLEASE,
]);

export function serviceModelsCompatible(left: ServiceModel, right: ServiceModel): boolean {
  if (left === right) return false;
  if (left === ServiceModel.SALE_BROKERAGE) return saleCompatibleRentalModels.has(right);
  if (right === ServiceModel.SALE_BROKERAGE) return saleCompatibleRentalModels.has(left);
  return false;
}

export function assertCompatibleModels(models: readonly ServiceModel[]): void {
  for (let left = 0; left < models.length; left += 1) {
    for (let right = left + 1; right < models.length; right += 1) {
      if (!serviceModelsCompatible(models[left]!, models[right]!)) {
        throw new ConflictException(
          `${models[left]} cannot overlap ${models[right]} for the same scope.`,
        );
      }
    }
  }
}

export function classifyEngagementPeriod(
  effectiveFrom: Date,
  effectiveTo: Date | null,
  businessDate: Date,
): EngagementPeriod {
  if (effectiveFrom > businessDate) return 'SCHEDULED';
  if (effectiveTo && effectiveTo <= businessDate) return 'HISTORICAL';
  return 'CURRENT';
}

export function displayEngagementStatus(
  status: ServiceEngagementStatus,
  effectiveTo: Date | null,
  businessDate: Date,
): ServiceEngagementStatus {
  return status === ServiceEngagementStatus.ACTIVE && effectiveTo && effectiveTo <= businessDate
    ? ServiceEngagementStatus.EXPIRED
    : status;
}

export function assertServiceModelScope(
  serviceModel: ServiceModel,
  rentableSpaceId?: string | null,
): void {
  if (
    rentableSpaceId &&
    new Set<ServiceModel>([ServiceModel.SALE_BROKERAGE, ServiceModel.COMPANY_OWNED]).has(
      serviceModel,
    )
  ) {
    throw new BadRequestException(
      'Sale Brokerage and Company Owned engagements must use Property scope.',
    );
  }
}

export function assertLifecycleTransition(
  current: ServiceEngagementStatus,
  target: ServiceEngagementStatus,
  period: EngagementPeriod,
): void {
  const allowed: ServiceEngagementStatus[] =
    current === ServiceEngagementStatus.DRAFT
      ? [ServiceEngagementStatus.ACTIVE, ServiceEngagementStatus.CANCELLED]
      : current === ServiceEngagementStatus.ACTIVE
        ? period === 'SCHEDULED'
          ? [ServiceEngagementStatus.CANCELLED]
          : period === 'CURRENT'
            ? [ServiceEngagementStatus.INACTIVE]
            : [ServiceEngagementStatus.EXPIRED]
        : [];
  if (!allowed.includes(target)) {
    throw new BadRequestException(
      `Service Engagement cannot transition from ${current} to ${target} during its ${period.toLowerCase()} period.`,
    );
  }
}

const emptyCapabilities = (): CapabilitySet =>
  Object.fromEntries(capabilityNames.map((name) => [name, false])) as CapabilitySet;

function applyModel(capabilities: CapabilitySet, model: ServiceModel): void {
  applyPropertySaleModel(capabilities, model);
  const rentalConversion = () => {
    capabilities.canCreateRentalListing = true;
    capabilities.canMarketRentalSpace = true;
    capabilities.canReceiveRentalLead = true;
    capabilities.canCreateViewing = true;
    capabilities.canAcceptApplication = true;
    capabilities.canReserveSpace = true;
    capabilities.canCreateLease = true;
  };

  if (
    new Set<ServiceModel>([
      ServiceModel.RENTAL_BROKERAGE,
      ServiceModel.TENANT_PLACEMENT,
      ServiceModel.FULL_MANAGEMENT,
      ServiceModel.MASTER_LEASE_SUBLEASE,
      ServiceModel.COMPANY_OWNED,
    ]).has(model)
  ) {
    rentalConversion();
  }
  if (
    new Set<ServiceModel>([
      ServiceModel.FULL_MANAGEMENT,
      ServiceModel.RENT_COLLECTION_ONLY,
      ServiceModel.MASTER_LEASE_SUBLEASE,
      ServiceModel.COMPANY_OWNED,
    ]).has(model)
  ) {
    capabilities.canCollectRent = true;
  }
  if (
    new Set<ServiceModel>([
      ServiceModel.FULL_MANAGEMENT,
      ServiceModel.MASTER_LEASE_SUBLEASE,
      ServiceModel.COMPANY_OWNED,
    ]).has(model)
  ) {
    capabilities.canManageMaintenance = true;
  }
}

function applyPropertySaleModel(capabilities: CapabilitySet, model: ServiceModel): void {
  if (model === ServiceModel.SALE_BROKERAGE || model === ServiceModel.COMPANY_OWNED) {
    capabilities.canCreateSaleListing = true;
    capabilities.canMarketPropertyForSale = true;
    capabilities.canReceiveBuyerLead = true;
    capabilities.canReceiveSellerLead = model === ServiceModel.SALE_BROKERAGE;
    capabilities.canCreateViewing = true;
  }
}

export function resolveCapabilitySet(
  propertyModels: readonly ServiceModel[],
  spaceModels: readonly ServiceModel[] = [],
): CapabilitySet {
  const capabilities = emptyCapabilities();
  if (!spaceModels.length) {
    for (const model of propertyModels) applyModel(capabilities, model);
    return capabilities;
  }
  const propertySaleModels = propertyModels.filter((model) => !rentalScopedModels.has(model));
  const rentalModels = spaceModels.filter((model) => rentalScopedModels.has(model));
  // Space rental authority overrides inherited Property rental authority. Sale
  // authority remains Property-wide and is inherited independently.
  for (const model of propertySaleModels) applyPropertySaleModel(capabilities, model);
  for (const model of rentalModels) applyModel(capabilities, model);
  return capabilities;
}
