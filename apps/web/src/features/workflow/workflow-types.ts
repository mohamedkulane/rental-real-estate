export type WorkflowType =
  'PROPERTY_ONBOARDING' | 'RENTAL_BROKERAGE' | 'FULL_MANAGEMENT' | 'PROPERTY_SALE';
export type WorkflowPayload = {
  partyId?: string;
  ownershipPlan?: {
    effectiveFrom: string;
    reason: string;
    shares: Array<{ ownerPartyId: string; ownershipPercent: string; payoutPercent: string }>;
  };
  ownerPartyId?: string;
  propertyId?: string;
  ownershipId?: string;
  buildingIds?: string[];
  rentableSpaceIds?: string[];
  serviceEngagementId?: string;
  documentIds?: string[];
  structureRequired?: boolean;
  rentableSpacesRequired?: boolean;
  companyServiceRequired?: boolean;
  readinessNotes?: string;
  managementTerms?: string;
};
export type WorkflowRecord = {
  id: string;
  branchId: string;
  branch?: { name: string; code: string };
  type: WorkflowType;
  status: string;
  currentStep: number;
  version: number;
  payload: WorkflowPayload;
  updatedAt: string;
};
export const workflowLabels: Record<WorkflowType, string> = {
  PROPERTY_ONBOARDING: 'Property Onboarding',
  RENTAL_BROKERAGE: 'Rental Brokerage',
  FULL_MANAGEMENT: 'Full Management',
  PROPERTY_SALE: 'Property Sale',
};
export type WorkflowStepKind =
  | 'owner'
  | 'ownership'
  | 'property'
  | 'buildings'
  | 'spaces'
  | 'engagement'
  | 'details'
  | 'documents'
  | 'review';
export const workflowSteps: Record<
  WorkflowType,
  ReadonlyArray<{ label: string; kind: WorkflowStepKind }>
> = {
  PROPERTY_ONBOARDING: [
    { label: 'Owner / Party', kind: 'owner' },
    { label: 'Ownership', kind: 'ownership' },
    { label: 'Property Details', kind: 'property' },
    { label: 'Building / Structure', kind: 'buildings' },
    { label: 'Rentable Spaces', kind: 'spaces' },
    { label: 'Company Service', kind: 'engagement' },
    { label: 'Documents', kind: 'documents' },
    { label: 'Review & Complete', kind: 'review' },
  ],
  RENTAL_BROKERAGE: [
    { label: 'Owner', kind: 'owner' },
    { label: 'Property', kind: 'property' },
    { label: 'Rentable Spaces', kind: 'spaces' },
    { label: 'Rental Brokerage Service', kind: 'engagement' },
    { label: 'Brokerage Readiness', kind: 'details' },
    { label: 'Documents', kind: 'documents' },
    { label: 'Review', kind: 'review' },
    { label: 'Activate', kind: 'review' },
  ],
  FULL_MANAGEMENT: [
    { label: 'Owner', kind: 'owner' },
    { label: 'Property', kind: 'property' },
    { label: 'Ownership Eligibility', kind: 'ownership' },
    { label: 'Rentable Spaces', kind: 'spaces' },
    { label: 'Full Management Service', kind: 'engagement' },
    { label: 'Management Terms', kind: 'details' },
    { label: 'Documents', kind: 'documents' },
    { label: 'Review & Activate', kind: 'review' },
  ],
  PROPERTY_SALE: [
    { label: 'Seller (if external)', kind: 'owner' },
    { label: 'Property', kind: 'property' },
    { label: 'Ownership Evidence', kind: 'ownership' },
    { label: 'Sale Authority', kind: 'engagement' },
    { label: 'Sale Readiness', kind: 'details' },
    { label: 'Documents', kind: 'documents' },
    { label: 'Review', kind: 'review' },
    { label: 'Activate', kind: 'review' },
  ],
};
