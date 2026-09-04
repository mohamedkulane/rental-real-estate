import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsDefined,
  IsEmail,
  IsEnum,
  IsInt,
  IsISO4217CurrencyCode,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  AreaUnit,
  ConstructionCategory,
  FinancingReadiness,
  FurnishedPreference,
  LeadActivityDirection,
  LeadActivityType,
  LeadFollowUpState,
  LeadIntent,
  LeadLostReason,
  LeadRentPeriod,
  LeadSourceStatus,
  LeadStage,
  SellerRelationship,
  SiteControl,
} from '@prisma/client';

const arrayInput = ({ value }: { value: unknown }) =>
  Array.isArray(value) ? value : value === undefined ? undefined : [value];
const DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/;

export class CrmPageQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 25;
  @IsOptional() @IsString() @MaxLength(2048) cursor?: string;
}

export class LeadListQueryDto extends CrmPageQueryDto {
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional()
  @Transform(arrayInput)
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  branchId?: string[];
  @IsOptional()
  @Transform(arrayInput)
  @IsArray()
  @ArrayMaxSize(7)
  @IsEnum(LeadStage, { each: true })
  stage?: LeadStage[];
  @IsOptional()
  @Transform(arrayInput)
  @IsArray()
  @ArrayMaxSize(4)
  @IsEnum(LeadIntent, { each: true })
  intent?: LeadIntent[];
  @IsOptional()
  @Transform(arrayInput)
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  sourceId?: string[];
  @IsOptional() @IsUUID() assigneeEmployeeId?: string;
  @IsOptional() @IsDateString({ strict: true }) createdFrom?: string;
  @IsOptional() @IsDateString({ strict: true }) createdTo?: string;
}

export class LeadPreferenceDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  preferredAreaText?: string[];
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional() @IsDateString({ strict: true }) desiredByDate?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  propertyTypeCodes?: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  rentableSpaceTypeCodes?: string[];
  @IsOptional() @IsString() @Matches(DECIMAL) minRent?: string;
  @IsOptional() @IsString() @Matches(DECIMAL) maxRent?: string;
  @IsOptional() @IsString() @IsISO4217CurrencyCode() currency?: string;
  @IsOptional() @IsEnum(LeadRentPeriod) rentPeriod?: LeadRentPeriod;
  @IsOptional() @IsInt() @Min(0) @Max(100) minBedrooms?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) maxBedrooms?: number;
  @IsOptional() @IsString() @Matches(DECIMAL) minBathrooms?: string;
  @IsOptional() @IsString() @Matches(DECIMAL) maxBathrooms?: string;
  @IsOptional() @IsString() @Matches(DECIMAL) minArea?: string;
  @IsOptional() @IsString() @Matches(DECIMAL) maxArea?: string;
  @IsOptional() @IsEnum(AreaUnit) areaUnit?: AreaUnit;
  @IsOptional() @IsDateString({ strict: true }) moveInDate?: string;
  @IsOptional() @IsEnum(FurnishedPreference) furnishedPreference?: FurnishedPreference;
  @IsOptional() @IsBoolean() parkingRequired?: boolean;
  @IsOptional() @IsUUID() rentableSpaceId?: string;
  @IsOptional() @IsString() @Matches(DECIMAL) minBudget?: string;
  @IsOptional() @IsString() @Matches(DECIMAL) maxBudget?: string;
  @IsOptional() @IsDateString({ strict: true }) targetPurchaseDate?: string;
  @IsOptional() @IsEnum(FinancingReadiness) financingReadiness?: FinancingReadiness;
  @IsOptional() @IsUUID() propertyId?: string;
  @IsOptional() @IsString() @MaxLength(500) subjectDescription?: string;
  @IsOptional() @IsString() @MaxLength(300) subjectLocation?: string;
  @IsOptional() @IsString() @Matches(DECIMAL) expectedMinPrice?: string;
  @IsOptional() @IsString() @Matches(DECIMAL) askingPrice?: string;
  @IsOptional() @IsDateString({ strict: true }) desiredSaleDate?: string;
  @IsOptional() @IsEnum(SellerRelationship) sellerRelationship?: SellerRelationship;
  @IsOptional() @IsString() @MinLength(3) @MaxLength(2000) projectBrief?: string;
  @IsOptional() @IsString() @MaxLength(300) siteLocation?: string;
  @IsOptional() @IsEnum(ConstructionCategory) category?: ConstructionCategory;
  @IsOptional() @IsString() @Matches(DECIMAL) estimatedMinBudget?: string;
  @IsOptional() @IsString() @Matches(DECIMAL) estimatedMaxBudget?: string;
  @IsOptional() @IsDateString({ strict: true }) targetStartDate?: string;
  @IsOptional() @IsDateString({ strict: true }) targetCompletionDate?: string;
  @IsOptional() @IsString() @Matches(DECIMAL) plotArea?: string;
  @IsOptional() @IsString() @Matches(DECIMAL) floorArea?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) bedrooms?: number;
  @IsOptional() @IsInt() @Min(0) @Max(200) floors?: number;
  @IsOptional() @IsEnum(SiteControl) siteControl?: SiteControl;
}

export class CreateLeadDto {
  @IsEnum(LeadIntent) intent!: LeadIntent;
  @IsUUID() sourceId!: string;
  @IsUUID() responsibleBranchId!: string;
  @IsOptional() @IsUUID() currentAssigneeEmployeeId?: string;
  @IsOptional() @IsUUID() partyId?: string;
  @IsString() @Length(1, 240) displayName!: string;
  @IsOptional() @IsString() @Length(5, 80) phone?: string;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @IsDefined() @ValidateNested() @Type(() => LeadPreferenceDto) preference!: LeadPreferenceDto;
}

export class VersionedReasonDto {
  @Type(() => Number) @IsInt() @Min(1) expectedVersion!: number;
  @IsString() @Length(3, 500) reason!: string;
}

export class UpdateLeadDto extends VersionedReasonDto {
  @IsOptional() @IsUUID() sourceId?: string;
  @IsOptional() @IsString() @Length(1, 240) displayName?: string;
  @IsOptional() @IsString() @Length(5, 80) phone?: string | null;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string | null;
  @IsOptional() @ValidateNested() @Type(() => LeadPreferenceDto) preference?: LeadPreferenceDto;
}

export class CorrectLeadIntentDto extends VersionedReasonDto {
  @IsEnum(LeadIntent) intent!: LeadIntent;
  @IsDefined() @ValidateNested() @Type(() => LeadPreferenceDto) preference!: LeadPreferenceDto;
}

export class LinkPartyDto extends VersionedReasonDto {
  @IsUUID() partyId!: string;
}
export class AssignmentDto extends VersionedReasonDto {
  @IsUUID() employeeId!: string;
}
export class BranchTransferDto extends VersionedReasonDto {
  @IsUUID() destinationBranchId!: string;
  @IsOptional() @IsUUID() replacementEmployeeId?: string;
  @IsOptional() @IsBoolean() clearAssignee?: boolean;
}
export class ContactedTransitionDto {
  @Type(() => Number) @IsInt() @Min(1) expectedVersion!: number;
  @IsUUID() activityId!: string;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
export class StageTransitionDto {
  @Type(() => Number) @IsInt() @Min(1) expectedVersion!: number;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
export class MatchingTransitionDto extends StageTransitionDto {
  @IsString() @Length(1, 120) readinessLabel!: string;
}
export class NurturingTransitionDto extends VersionedReasonDto {
  @IsUUID() followUpId!: string;
}
export class ConvertedTransitionDto {
  @Type(() => Number) @IsInt() @Min(1) expectedVersion!: number;
  @IsString() @Length(3, 1000) outcomeSummary!: string;
  @IsOptional() @IsString() @MaxLength(160) externalReference?: string;
}
export class LostTransitionDto {
  @Type(() => Number) @IsInt() @Min(1) expectedVersion!: number;
  @IsEnum(LeadLostReason) lostReason!: LeadLostReason;
  @IsOptional() @IsString() @MaxLength(500) lostNotes?: string;
}

export class ActivityListQueryDto extends CrmPageQueryDto {
  @IsOptional() @IsEnum(LeadActivityType) type?: LeadActivityType;
  @IsOptional() @IsEnum(LeadActivityDirection) direction?: LeadActivityDirection;
}
export class CreateActivityDto {
  @IsEnum(LeadActivityType) type!: LeadActivityType;
  @IsEnum(LeadActivityDirection) direction!: LeadActivityDirection;
  @IsString() @Length(1, 500) summary!: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsDateString() occurredAt!: string;
}
export class CorrectActivityDto extends CreateActivityDto {
  @IsString() @Length(3, 500) reason!: string;
}
export class ReasonDto {
  @IsString() @Length(3, 500) reason!: string;
}

export enum FollowUpDerivedStatus {
  OPEN = 'OPEN',
  OVERDUE = 'OVERDUE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}
export class FollowUpListQueryDto extends CrmPageQueryDto {
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional()
  @Transform(arrayInput)
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  branchId?: string[];
  @IsOptional()
  @Transform(arrayInput)
  @IsArray()
  @ArrayMaxSize(3)
  @IsEnum(LeadFollowUpState, { each: true })
  state?: LeadFollowUpState[];
  @IsOptional() @IsEnum(FollowUpDerivedStatus) derivedStatus?: FollowUpDerivedStatus;
  @IsOptional() @IsDateString() dueFrom?: string;
  @IsOptional() @IsDateString() dueTo?: string;
  @IsOptional() @IsUUID() responsibleEmployeeId?: string;
  @IsOptional() @IsUUID() leadId?: string;
}
export class CreateFollowUpDto {
  @IsString() @Length(1, 300) subject!: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsDateString() dueAt!: string;
  @IsUUID() responsibleEmployeeId!: string;
  @IsOptional() @IsUUID() predecessorFollowUpId?: string;
}
export class UpdateFollowUpDto extends VersionedReasonDto {
  @IsOptional() @IsString() @Length(1, 300) subject?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string | null;
  @IsOptional() @IsDateString() dueAt?: string;
}

export class SourceListQueryDto extends CrmPageQueryDto {
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsEnum(LeadSourceStatus) status?: LeadSourceStatus;
}
export class CreateSourceDto {
  @IsString() @Matches(/^[A-Z][A-Z0-9_]{1,49}$/) code!: string;
  @IsString() @Length(1, 120) label!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000000) sortOrder?: number;
}
export class UpdateSourceDto {
  @Type(() => Number) @IsInt() @Min(1) expectedVersion!: number;
  @IsOptional() @IsString() @Length(1, 120) label?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000000) sortOrder?: number;
}

export class PipelineQueryDto extends LeadListQueryDto {
  @IsOptional() @IsEnum(LeadStage) pipelineStage?: LeadStage;
}
export enum BranchSelectorPurpose {
  LEAD_REGISTER = 'LEAD_REGISTER',
  PIPELINE = 'PIPELINE',
  FOLLOW_UPS = 'FOLLOW_UPS',
  CREATE_LEAD = 'CREATE_LEAD',
  TRANSFER_LEAD = 'TRANSFER_LEAD',
}
export class BranchSelectorQueryDto extends CrmPageQueryDto {
  @IsEnum(BranchSelectorPurpose) purpose!: BranchSelectorPurpose;
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsUUID() leadId?: string;
}
export enum EmployeeSelectorPurpose {
  ASSIGNMENT_READ = 'ASSIGNMENT_READ',
  ASSIGN_LEAD = 'ASSIGN_LEAD',
  REASSIGN_LEAD = 'REASSIGN_LEAD',
  CREATE_FOLLOW_UP = 'CREATE_FOLLOW_UP',
  INITIAL_ASSIGNMENT = 'INITIAL_ASSIGNMENT',
  TRANSFER_REPLACEMENT = 'TRANSFER_REPLACEMENT',
}
export class EmployeeSelectorQueryDto extends CrmPageQueryDto {
  @IsEnum(EmployeeSelectorPurpose) purpose!: EmployeeSelectorPurpose;
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsUUID() leadId?: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsUUID() destinationBranchId?: string;
}
export enum ReferenceSelectorPurpose {
  CREATE_LEAD = 'CREATE_LEAD',
  UPDATE_LEAD = 'UPDATE_LEAD',
}
export class ReferenceSelectorQueryDto extends CrmPageQueryDto {
  @IsEnum(ReferenceSelectorPurpose) purpose!: ReferenceSelectorPurpose;
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsUUID() leadId?: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsEnum(LeadIntent) intent?: LeadIntent;
  @IsOptional() @IsUUID() propertyId?: string;
}
