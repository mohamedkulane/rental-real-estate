import {
  DevelopmentCostCategory,
  DevelopmentPlotStatus,
  DevelopmentProjectStatus,
  DevelopmentType,
} from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CursorPageQueryDto } from '../common/cursor-pagination';

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
