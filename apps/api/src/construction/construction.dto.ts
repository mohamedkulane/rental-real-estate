import {
  ConstructionBillingBasis,
  ConstructionBudgetCategory,
  ConstructionContractStatus,
  ConstructionEconomicModel,
  ConstructionMilestoneStatus,
  ConstructionProjectStatus,
  ConstructionWorkPackagePriority,
  ConstructionWorkPackageStatus,
  DevelopmentCostCategory,
  DevelopmentPlotStatus,
  DevelopmentProjectStatus,
  DevelopmentType,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CursorPageQueryDto } from '../common/cursor-pagination';

export class ConstructionProjectQueryDto extends CursorPageQueryDto {
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsEnum(ConstructionProjectStatus) status?: ConstructionProjectStatus;
  @IsOptional() @IsEnum(ConstructionEconomicModel) economicModel?: ConstructionEconomicModel;
}

export class CreateConstructionProjectDto {
  @IsUUID() branchId!: string;
  @IsString() @MinLength(3) @MaxLength(200) name!: string;
  @IsEnum(ConstructionEconomicModel) economicModel!: ConstructionEconomicModel;
  @IsOptional() @IsUUID() clientPartyId?: string;
  @IsOptional() @IsUUID() propertyId?: string;
  @IsOptional() @IsUUID() leadId?: string;
  @IsOptional() @IsUUID() developmentProjectId?: string;
  @IsOptional() @IsUUID() projectManagerEmployeeId?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() expectedEndDate?: string;
  @IsOptional() @IsString() @MaxLength(4000) scope?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsNumberString() contractValue?: string;
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
}

export class ConstructionProjectTransitionDto {
  @IsEnum(ConstructionProjectStatus) status!: ConstructionProjectStatus;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class ConstructionPaymentTermDto {
  @IsOptional() sequence?: number;
  @IsString() @MaxLength(160) label!: string;
  @IsOptional() @IsNumberString() percent?: string;
  @IsOptional() @IsNumberString() amount?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class CreateConstructionContractDto {
  @IsUUID() constructionProjectId!: string;
  @IsNumberString() contractValue!: string;
  @IsString() @MaxLength(1000) paymentTermsSummary!: string;
  @IsDateString() effectiveDate!: string;
  @IsOptional() @IsDateString() completionTarget?: string;
  @IsOptional() @IsNumberString() retentionPercent?: string;
  @IsOptional() @IsString() @MaxLength(4000) scope?: string;
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConstructionPaymentTermDto)
  installments!: ConstructionPaymentTermDto[];
}

export class ConstructionContractTransitionDto {
  @IsEnum(ConstructionContractStatus) status!: ConstructionContractStatus;
}

export class UpsertConstructionBudgetLineDto {
  @IsUUID() constructionProjectId!: string;
  @IsEnum(ConstructionBudgetCategory) category!: ConstructionBudgetCategory;
  @IsString() @MaxLength(160) label!: string;
  @IsNumberString() budgetAmount!: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class CreateConstructionMilestoneDto {
  @IsUUID() constructionProjectId!: string;
  @IsString() @MinLength(2) @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() sequence?: number;
  @IsOptional() @IsDateString() plannedStart?: string;
  @IsOptional() @IsDateString() plannedEnd?: string;
  @IsOptional() @IsUUID() assigneeEmployeeId?: string;
}

export class ConstructionMilestoneTransitionDto {
  @IsEnum(ConstructionMilestoneStatus) status!: ConstructionMilestoneStatus;
  @IsOptional() @IsNumberString() percentComplete?: string;
}

export class CreateConstructionWorkPackageDto {
  @IsUUID() constructionProjectId!: string;
  @IsOptional() @IsUUID() milestoneId?: string;
  @IsString() @MinLength(2) @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsUUID() assigneeEmployeeId?: string;
  @IsOptional() @IsUUID() vendorPartyId?: string;
  @IsOptional() @IsEnum(ConstructionWorkPackagePriority) priority?: ConstructionWorkPackagePriority;
  @IsOptional() @IsDateString() scheduledStart?: string;
  @IsOptional() @IsDateString() scheduledEnd?: string;
  @IsOptional() @IsNumberString() estimatedCost?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsUUID() dependsOnId?: string;
}

export class ConstructionWorkPackageTransitionDto {
  @IsEnum(ConstructionWorkPackageStatus) status!: ConstructionWorkPackageStatus;
}

export class RecordConstructionCostDto {
  @IsUUID() constructionProjectId!: string;
  @IsOptional() @IsUUID() milestoneId?: string;
  @IsOptional() @IsUUID() workPackageId?: string;
  @IsOptional() @IsUUID() vendorPartyId?: string;
  @IsEnum(ConstructionBudgetCategory) category!: ConstructionBudgetCategory;
  @IsNumberString() amount!: string;
  @IsDateString() businessDate!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() @MaxLength(180) idempotencyKey?: string;
}

export class CreateConstructionBillingDto {
  @IsUUID() constructionProjectId!: string;
  @IsUUID() contractId!: string;
  @IsEnum(ConstructionBillingBasis) basis!: ConstructionBillingBasis;
  @IsNumberString() amount!: string;
  @IsDateString() dueDate!: string;
  @IsOptional() @IsUUID() milestoneId?: string;
  @IsOptional() installmentSequence?: number;
  @IsOptional() @IsString() @MaxLength(180) idempotencyKey?: string;
}

export class RecordConstructionProgressDto {
  @IsUUID() constructionProjectId!: string;
  @IsNumberString() plannedPercent!: string;
  @IsNumberString() actualPercent!: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class LinkConstructionDocumentDto {
  @IsUUID() documentId!: string;
  @IsOptional() @IsString() @MaxLength(50) purpose?: string;
}

export class DevelopmentProjectQueryDto extends CursorPageQueryDto {
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsEnum(DevelopmentProjectStatus) status?: DevelopmentProjectStatus;
}

export class CreateDevelopmentProjectDto {
  @IsUUID() branchId!: string;
  @IsUUID() sourcePropertyId!: string;
  @IsString() @MinLength(3) @MaxLength(200) name!: string;
  @IsEnum(DevelopmentType) developmentType!: DevelopmentType;
  @IsOptional() @IsUUID() projectManagerEmployeeId?: string;
  @IsOptional() @IsDateString() plannedStart?: string;
  @IsOptional() @IsDateString() plannedCompletion?: string;
  @IsOptional() @IsNumberString() totalArea?: string;
  @IsOptional() @IsString() @MaxLength(20) areaUnit?: string;
  @IsOptional() @IsNumberString() budgetAmount?: string;
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class DevelopmentProjectTransitionDto {
  @IsEnum(DevelopmentProjectStatus) status!: DevelopmentProjectStatus;
}

export class CreateDevelopmentBlockDto {
  @IsUUID() developmentProjectId!: string;
  @IsString() @MaxLength(40) code!: string;
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsNumberString() area?: string;
  @IsOptional() @IsString() @MaxLength(200) purpose?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class CreateDevelopmentPlotDto {
  @IsUUID() developmentProjectId!: string;
  @IsOptional() @IsUUID() blockId?: string;
  @IsString() @MaxLength(40) plotNumber!: string;
  @IsOptional() @IsNumberString() plannedArea?: string;
  @IsOptional() @IsString() @MaxLength(80) useType?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class DevelopmentPlotTransitionDto {
  @IsEnum(DevelopmentPlotStatus) status!: DevelopmentPlotStatus;
}

export class UpsertDevelopmentBudgetLineDto {
  @IsUUID() developmentProjectId!: string;
  @IsEnum(DevelopmentCostCategory) category!: DevelopmentCostCategory;
  @IsString() @MaxLength(160) label!: string;
  @IsNumberString() budgetAmount!: string;
}

export class RecordDevelopmentCostDto {
  @IsUUID() developmentProjectId!: string;
  @IsOptional() @IsUUID() vendorPartyId?: string;
  @IsEnum(DevelopmentCostCategory) category!: DevelopmentCostCategory;
  @IsNumberString() amount!: string;
  @IsDateString() businessDate!: string;
  @IsOptional() @IsString() @MaxLength(500) allocationNotes?: string;
  @IsOptional() @IsString() @MaxLength(180) idempotencyKey?: string;
}

export class ConvertDevelopmentPlotDto {
  @IsUUID() plotId!: string;
  @IsString() @MinLength(2) @MaxLength(200) propertyName!: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsBoolean() createSaleListing?: boolean;
  @IsOptional() @IsNumberString() askingPrice?: string;
}

export class AttachDevelopmentConstructionDto {
  @IsUUID() developmentProjectId!: string;
  @IsString() @MinLength(3) @MaxLength(200) name!: string;
}
