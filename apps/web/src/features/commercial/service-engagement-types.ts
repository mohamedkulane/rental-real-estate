import type { CursorPage } from '@/lib/phase3-api';

export type ServiceModel =
  | 'RENTAL_BROKERAGE'
  | 'SALE_BROKERAGE'
  | 'TENANT_PLACEMENT'
  | 'FULL_MANAGEMENT'
  | 'RENT_COLLECTION_ONLY'
  | 'MASTER_LEASE_SUBLEASE'
  | 'COMPANY_OWNED';

export type EngagementStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'CANCELLED';
export type EngagementPeriod = 'CURRENT' | 'SCHEDULED' | 'HISTORICAL';

export interface EngagementRecord {
  id: string;
  engagementNumber: string;
  serviceModel: ServiceModel;
  status: EngagementStatus;
  period: EngagementPeriod;
  propertyId: string;
  rentableSpaceId: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
  version: number;
  property: {
    id: string;
    propertyCode: string;
    name: string;
    branchAssignments?: Array<{ branch: { id: string; code: string; name: string } }>;
  };
  rentableSpace: { id: string; spaceCode: string; name: string } | null;
}

export interface EngagementPage extends CursorPage<EngagementRecord> {
  totalCount: number;
}

export interface EngagementDetail extends EngagementRecord {
  resolvedCapabilities: Record<string, boolean>;
  history: Array<{
    id: string;
    fromStatus: EngagementStatus | null;
    toStatus: EngagementStatus;
    action: string;
    reason: string | null;
    occurredAt: string;
    actor: { employee: { party: { displayName: string } } | null };
  }>;
}

export interface PropertyOption {
  id: string;
  propertyCode: string;
  name: string;
}

export interface SpaceOption {
  id: string;
  spaceCode: string;
  name: string;
}

export const serviceModels: Array<{ value: ServiceModel; label: string }> = [
  { value: 'RENTAL_BROKERAGE', label: 'Rental Brokerage' },
  { value: 'SALE_BROKERAGE', label: 'Sale Brokerage' },
  { value: 'TENANT_PLACEMENT', label: 'Tenant Placement' },
  { value: 'FULL_MANAGEMENT', label: 'Full Management' },
  { value: 'RENT_COLLECTION_ONLY', label: 'Rent Collection Only' },
  { value: 'MASTER_LEASE_SUBLEASE', label: 'Master Lease / Sublease' },
  { value: 'COMPANY_OWNED', label: 'Company Owned' },
];

export const capabilityLabel = (name: string): string => {
  const words = name.replace(/^can/, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return words.charAt(0).toUpperCase() + words.slice(1);
};
