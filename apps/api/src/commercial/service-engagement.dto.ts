import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ServiceEngagementStatus, ServiceModel } from '@prisma/client';

export enum EngagementPeriodFilter {
  CURRENT = 'CURRENT',
  SCHEDULED = 'SCHEDULED',
  HISTORICAL = 'HISTORICAL',
}

export class ListServiceEngagementsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @IsUUID() cursor?: string;
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsUUID() propertyId?: string;
  @IsOptional() @IsUUID() rentableSpaceId?: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsEnum(ServiceModel) serviceModel?: ServiceModel;
  @IsOptional() @IsEnum(ServiceEngagementStatus) status?: ServiceEngagementStatus;
  @IsOptional() @IsEnum(EngagementPeriodFilter) period?: EngagementPeriodFilter;
}

export class CreateServiceEngagementDto {
  @IsEnum(ServiceModel) serviceModel!: ServiceModel;
  @IsUUID() propertyId!: string;
  @IsOptional() @IsUUID() rentableSpaceId?: string;
  @IsDateString({ strict: true }) effectiveFrom!: string;
  @IsOptional() @IsDateString({ strict: true }) effectiveTo?: string;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
}

export class UpdateServiceEngagementDto {
  @IsOptional() @IsEnum(ServiceModel) serviceModel?: ServiceModel;
  @IsOptional() @IsUUID() propertyId?: string;
  @IsOptional() @IsUUID() rentableSpaceId?: string | null;
  @IsOptional() @IsDateString({ strict: true }) effectiveFrom?: string;
  @IsOptional() @IsDateString({ strict: true }) effectiveTo?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string | null;
  @Type(() => Number) @IsInt() @Min(1) version!: number;
}

export class ServiceEngagementTransitionDto {
  @IsString() @Length(3, 500) reason!: string;
  @Type(() => Number) @IsInt() @Min(1) version!: number;
}

export class ResolveCapabilitiesQueryDto {
  @IsUUID() propertyId!: string;
  @IsOptional() @IsUUID() rentableSpaceId?: string;
  @IsOptional() @IsDateString({ strict: true }) businessDate?: string;
}

export class ListServiceEngagementActivityQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @IsUUID() cursor?: string;
}
