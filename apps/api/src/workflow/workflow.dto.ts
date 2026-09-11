import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsDefined,
  IsObject,
  IsIn,
  Length,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { WorkflowStatus, WorkflowType } from '@prisma/client';
import { CreateServiceEngagementDto } from '../commercial/service-engagement.dto';
import {
  CreatePartyDto,
  CreateOwnerDto,
  CreatePropertyDto,
  CreateBuildingDto,
  CreateSpaceDto,
  ReplaceOwnershipDto,
} from '../portfolio/portfolio.dto';

export class WorkflowDraftPayloadDto {
  @IsOptional() @IsUUID() partyId?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => ReplaceOwnershipDto)
  ownershipPlan?: ReplaceOwnershipDto;
  @IsOptional() @IsUUID() ownerPartyId?: string;
  @IsOptional() @IsUUID() propertyId?: string;
  @IsOptional() @IsUUID() ownershipId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsUUID('all', { each: true }) buildingIds?: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  rentableSpaceIds?: string[];
  @IsOptional() @IsUUID() serviceEngagementId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsUUID('all', { each: true }) documentIds?: string[];
  @IsOptional() @IsBoolean() structureRequired?: boolean;
  @IsOptional() @IsBoolean() rentableSpacesRequired?: boolean;
  @IsOptional() @IsBoolean() companyServiceRequired?: boolean;
  @IsOptional() @IsString() @MaxLength(2000) readinessNotes?: string;
  @IsOptional() @IsString() @MaxLength(2000) managementTerms?: string;
}

export class CreateWorkflowDraftDto {
  @IsUUID() branchId!: string;
  @IsEnum(WorkflowType) type!: WorkflowType;
  @IsOptional() @IsInt() @Min(1) @Max(1) payloadSchemaVersion = 1;
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => WorkflowDraftPayloadDto)
  payload!: WorkflowDraftPayloadDto;
}

export class UpdateWorkflowDraftDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsInt() @Min(1) @Max(8) currentStep!: number;
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => WorkflowDraftPayloadDto)
  payload!: WorkflowDraftPayloadDto;
}

export class CancelWorkflowDraftDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsString() @MaxLength(500) reason!: string;
}

export class CompleteWorkflowDraftDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsString() @MaxLength(120) idempotencyKey!: string;
}

export class ListWorkflowDraftsDto {
  @IsOptional() @IsEnum(WorkflowType) type?: WorkflowType;
  @IsOptional() @IsEnum(WorkflowStatus) status?: WorkflowStatus;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsUUID() cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 20;
}

export class ListWorkflowBranchesDto {
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @IsUUID() cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 20;
}

export class WorkflowCommandDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsString() @Length(8, 120) idempotencyKey!: string;
  @IsIn([
    'PARTY',
    'OWNER',
    'PROPERTY',
    'OWNERSHIP',
    'BUILDING',
    'SPACE',
    'ENGAGEMENT',
    'ACTIVATE_PROPERTY',
    'ACTIVATE_SERVICE',
  ])
  command!:
    | 'PARTY'
    | 'OWNER'
    | 'PROPERTY'
    | 'OWNERSHIP'
    | 'BUILDING'
    | 'SPACE'
    | 'ENGAGEMENT'
    | 'ACTIVATE_PROPERTY'
    | 'ACTIVATE_SERVICE';
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateServiceEngagementDto)
  engagement?: CreateServiceEngagementDto;
  @IsOptional() @ValidateNested() @Type(() => CreatePartyDto) party?: CreatePartyDto;
  @IsOptional() @ValidateNested() @Type(() => CreateOwnerDto) owner?: CreateOwnerDto;
  @IsOptional() @ValidateNested() @Type(() => CreatePropertyDto) property?: CreatePropertyDto;
  @IsOptional() @ValidateNested() @Type(() => CreateBuildingDto) building?: CreateBuildingDto;
  @IsOptional() @ValidateNested() @Type(() => CreateSpaceDto) space?: CreateSpaceDto;
}
