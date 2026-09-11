import type { CursorPage } from '@/lib/phase3-api';

export type LeadIntent = 'RENT' | 'BUY' | 'SELL' | 'CONSTRUCTION_SERVICE';
export type LeadStage =
  'NEW' | 'CONTACTED' | 'QUALIFIED' | 'MATCHING' | 'NURTURING' | 'CONVERTED' | 'LOST';

export interface LeadSummary {
  id: string;
  leadNumber: string;
  displayName: string;
  intent: LeadIntent;
  stage: LeadStage;
  version: number;
  createdAt: string;
  updatedAt: string;
  source: { id: string; code: string; label: string; status: 'ACTIVE' | 'INACTIVE' };
  responsibleBranch: { id: string; code: string; name: string };
  currentAssignee: { id: string; employeeNumber: string; displayName: string } | null;
  contact: {
    phoneMasked: string | null;
    emailMasked: string | null;
    hasPhone: boolean;
    hasEmail: boolean;
  };
}

export interface LeadPage extends CursorPage<LeadSummary> {
  totalCount: number;
}

export interface PipelinePage {
  groups: Partial<Record<LeadStage, LeadPage>>;
  stageTotals: Record<LeadStage, number>;
  totalCount: number;
}

export interface LeadDetail extends LeadSummary {
  contact: LeadSummary['contact'] & { phone?: string | null; email?: string | null };
  preference: PreferenceResponse;
  party: { id: string; displayName: string; partyNumber: string; active: boolean } | null;
  property: { id: string; propertyCode: string; name: string } | null;
  rentableSpace: { id: string; spaceCode: string; name: string } | null;
  lostReason: string | null;
  lostNotes: string | null;
  outcomeSummary: string | null;
  externalReference: string | null;
}

export interface FollowUpRecord {
  id: string;
  version: number;
  subject: string;
  notes: string | null;
  state: 'OPEN' | 'COMPLETED' | 'CANCELLED';
  derivedStatus: 'OPEN' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE';
  leadId: string;
  branchId: string;
  responsibleEmployeeId: string;
  dueAt: string;
  lead: Pick<LeadSummary, 'id' | 'leadNumber' | 'displayName' | 'stage'>;
  createdAt: string;
  updatedAt: string;
  outcomeAt: string | null;
  outcomeReason: string | null;
  predecessorFollowUpId: string | null;
  responsibleEmployee: { id: string; employeeNumber: string; displayName: string };
}

export interface FollowUpPage extends CursorPage<FollowUpRecord> {
  totalCount: number;
  asOf: string;
}

type CommonPreferences = {
  preferredAreaText: string[];
  notes: string | null;
  desiredByDate: string | null;
};
type Dimensions = {
  minBedrooms: number | null;
  maxBedrooms: number | null;
  minBathrooms: string | null;
  maxBathrooms: string | null;
  minArea: string | null;
  maxArea: string | null;
  areaUnit: 'SQM' | 'SQFT' | 'HECTARE' | 'ACRE' | null;
};
export type PreferenceResponse = CommonPreferences &
  (
    | ({
        intent: 'RENT';
        propertyTypeCodes: string[];
        rentableSpaceTypeCodes: string[];
        minRent: string | null;
        maxRent: string | null;
        currency: string | null;
        rentPeriod: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | null;
        moveInDate: string | null;
        furnishedPreference: 'REQUIRED' | 'PREFERRED' | 'NOT_REQUIRED' | 'NO_PREFERENCE' | null;
        parkingRequired: boolean | null;
        rentableSpaceId: string | null;
      } & Dimensions)
    | ({
        intent: 'BUY';
        propertyTypeCodes: string[];
        minBudget: string | null;
        maxBudget: string | null;
        currency: string | null;
        targetPurchaseDate: string | null;
        financingReadiness:
          'CASH_READY' | 'FINANCE_PREAPPROVED' | 'FINANCE_NEEDED' | 'UNDECIDED' | null;
        propertyId: string | null;
      } & Dimensions)
    | {
        intent: 'SELL';
        propertyId: string | null;
        subjectDescription: string | null;
        subjectLocation: string | null;
        expectedMinPrice: string | null;
        askingPrice: string | null;
        currency: string | null;
        desiredSaleDate: string | null;
        sellerRelationship: 'OWNER' | 'AUTHORIZED_REPRESENTATIVE' | 'OTHER_UNVERIFIED' | null;
      }
    | {
        intent: 'CONSTRUCTION_SERVICE';
        projectBrief: string;
        category: 'NEW_BUILD' | 'EXTENSION' | 'RENOVATION' | 'OTHER';
        propertyId: string | null;
        siteLocation: string | null;
        estimatedMinBudget: string | null;
        estimatedMaxBudget: string | null;
        currency: string | null;
        targetStartDate: string | null;
        targetCompletionDate: string | null;
        plotArea: string | null;
        floorArea: string | null;
        areaUnit: 'SQM' | 'SQFT' | 'HECTARE' | 'ACRE' | null;
        bedrooms: number | null;
        floors: number | null;
        siteControl: 'OWNS_SITE' | 'AUTHORIZED_TO_BUILD' | 'SEEKING_SITE' | 'UNKNOWN' | null;
      }
  );

export interface LeadSourceRecord {
  id: string;
  code: string;
  label: string;
  description?: string | null;
  sortOrder: number;
  status: 'ACTIVE' | 'INACTIVE';
  usageCount: number;
  version: number;
}

export interface LeadSourcePage extends CursorPage<LeadSourceRecord> {
  totalCount: number;
}

export interface ActivityRecord {
  id: string;
  branchId: string;
  type: 'CALL' | 'EMAIL' | 'MESSAGE' | 'MEETING' | 'NOTE' | 'OTHER';
  direction: 'INBOUND' | 'OUTBOUND' | 'INTERNAL';
  summary: string;
  notes: string | null;
  occurredAt: string;
  recordedAt: string;
  recordKind: 'ORIGINAL' | 'CORRECTION' | 'VOID';
  originalActivityId: string | null;
  correctionReason: string | null;
}

export type HistoryRecord =
  | {
      id: string;
      occurredAt: string;
      kind: 'STAGE';
      fromStage: LeadStage | null;
      toStage: LeadStage;
      reason: string | null;
      leadVersion: number;
    }
  | {
      id: string;
      occurredAt: string;
      kind: 'INTENT';
      fromIntent: LeadIntent | null;
      toIntent: LeadIntent;
      reason: string;
      leadVersion: number;
    }
  | {
      id: string;
      occurredAt: string;
      kind: 'BRANCH';
      branchId: string;
      assignedFrom: string;
      assignedTo: string | null;
      reason: string;
    };

export interface AssignmentRecord {
  id: string;
  branchId: string;
  employeeId: string;
  employee: { id: string; employeeNumber: string; displayName: string };
  assignedFrom: string;
  assignedTo: string | null;
  reason: string;
}

export type Page<T> = CursorPage<T> & { totalCount: number };
export type MutationAck = { id: string; version: number };
export type SelectorOption = {
  id: string;
  code?: string;
  label?: string;
  name?: string;
  displayName?: string;
  employeeNumber?: string;
  partyNumber?: string;
  propertyCode?: string;
  spaceCode?: string;
  active?: boolean;
  capabilityAllowed?: boolean | null;
};

export const leadIntents: Array<{ value: LeadIntent; label: string; description: string }> = [
  { value: 'RENT', label: 'Rent', description: 'Rental need and move-in preferences' },
  { value: 'BUY', label: 'Buy', description: 'Property purchase enquiry' },
  { value: 'SELL', label: 'Sell', description: 'Property sale enquiry' },
  {
    value: 'CONSTRUCTION_SERVICE',
    label: 'Construction Service',
    description: 'Construction service intake only; no project is created',
  },
];

export const leadStages: LeadStage[] = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'MATCHING',
  'NURTURING',
  'CONVERTED',
  'LOST',
];
