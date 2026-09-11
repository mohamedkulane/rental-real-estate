import {
  DefectStatus,
  InspectionCondition,
  InspectionStatus,
  InspectionType,
  MaintenancePriority,
  MaintenanceRequestStatus,
  PartyKind,
  WorkOrderApprovalStatus,
  WorkOrderStatus,
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
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CursorPageQueryDto } from '../common/cursor-pagination';

export class OperationsQueryDto extends CursorPageQueryDto {
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsUUID() propertyId?: string;
}

export class MaintenanceQueryDto extends OperationsQueryDto {
  @IsOptional() @IsEnum(MaintenanceRequestStatus) status?: MaintenanceRequestStatus;
  @IsOptional() @IsEnum(MaintenancePriority) priority?: MaintenancePriority;
}

export class WorkOrderQueryDto extends OperationsQueryDto {
  @IsOptional() @IsEnum(WorkOrderStatus) status?: WorkOrderStatus;
}

export class InspectionQueryDto extends OperationsQueryDto {
  @IsOptional() @IsEnum(InspectionStatus) status?: InspectionStatus;
  @IsOptional() @IsEnum(InspectionType) type?: InspectionType;
}

export class VendorQueryDto extends CursorPageQueryDto {
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsBoolean() @Type(() => Boolean) active?: boolean;
}

export class CreateVendorServiceDto {
  @IsString() @Length(2, 50) categoryCode!: string;
  @IsString() @Length(2, 120) name!: string;
}

export class CreateVendorDto {
  @IsEnum(PartyKind) kind!: PartyKind;
  @IsString() @Length(2, 240) displayName!: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsArray() @ArrayMinSize(1) @IsUUID('all', { each: true }) branchIds!: string[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateVendorServiceDto)
  services?: CreateVendorServiceDto[];
}

export class UpdateVendorDto {
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) branchIds?: string[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateVendorServiceDto)
  services?: CreateVendorServiceDto[];
}

export class CreateMaintenanceRequestDto {
  @IsUUID() branchId!: string;
  @IsUUID() propertyId!: string;
  @IsOptional() @IsUUID() rentableSpaceId?: string;
  @IsOptional() @IsUUID() tenantPartyId?: string;
  @IsOptional() @IsUUID() reportedByPartyId?: string;
  @IsString() @Length(3, 200) title!: string;
  @IsString() @Length(3, 8000) description!: string;
  @IsString() @Length(2, 50) categoryCode!: string;
  @IsOptional() @IsEnum(MaintenancePriority) priority?: MaintenancePriority;
  @IsOptional() @IsDateString() reportedAt?: string;
  @IsOptional() @IsUUID() assignedEmployeeId?: string;
  @IsOptional() @IsUUID() assignedVendorPartyId?: string;
  @IsOptional() @IsUUID() serviceEngagementId?: string;
  @IsOptional() @IsUUID() sourceInspectionId?: string;
  @IsOptional() @IsUUID() sourceDefectId?: string;
}

export class MaintenanceTransitionDto {
  @IsEnum(MaintenanceRequestStatus) status!: MaintenanceRequestStatus;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional() @IsUUID() assignedEmployeeId?: string;
  @IsOptional() @IsUUID() assignedVendorPartyId?: string;
}

export class CreateWorkOrderDto {
  @IsUUID() branchId!: string;
  @IsOptional() @IsUUID() maintenanceRequestId?: string;
  @IsUUID() propertyId!: string;
  @IsOptional() @IsUUID() rentableSpaceId?: string;
  @IsOptional() @IsUUID() assignedEmployeeId?: string;
  @IsOptional() @IsUUID() vendorPartyId?: string;
  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsOptional() @IsString() @MaxLength(2000) laborNotes?: string;
  @IsOptional() @IsString() @MaxLength(2000) materialNotes?: string;
  @IsOptional() @IsNumberString() estimatedCost?: string;
  @IsString() @Length(3, 3) currency!: string;
  @IsOptional() @IsEnum(WorkOrderApprovalStatus) approvalStatus?: WorkOrderApprovalStatus;
}

export class WorkOrderTransitionDto {
  @IsEnum(WorkOrderStatus) status!: WorkOrderStatus;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsOptional() @IsDateString() startedAt?: string;
  @IsOptional() @IsDateString() completedAt?: string;
  @IsOptional() @IsString() @MaxLength(2000) laborNotes?: string;
  @IsOptional() @IsString() @MaxLength(2000) materialNotes?: string;
  @IsOptional() @IsNumberString() actualCost?: string;
  @IsOptional() @IsEnum(WorkOrderApprovalStatus) approvalStatus?: WorkOrderApprovalStatus;
}

export class CreateInspectionItemDto {
  @IsString() @Length(1, 120) area!: string;
  @IsString() @Length(1, 160) item!: string;
  @IsEnum(InspectionCondition) condition!: InspectionCondition;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional() @IsString() @MaxLength(30) severity?: string;
  @IsOptional() @IsUUID() photoDocumentId?: string;
}

export class CreateInspectionDto {
  @IsUUID() branchId!: string;
  @IsEnum(InspectionType) type!: InspectionType;
  @IsUUID() propertyId!: string;
  @IsOptional() @IsUUID() rentableSpaceId?: string;
  @IsOptional() @IsUUID() tenantPartyId?: string;
  @IsOptional() @IsUUID() inspectorEmployeeId?: string;
  @IsDateString() scheduledAt!: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateInspectionItemDto)
  items?: CreateInspectionItemDto[];
}

export class InspectionTransitionDto {
  @IsEnum(InspectionStatus) status!: InspectionStatus;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => CreateInspectionItemDto)
  items?: CreateInspectionItemDto[];
}

export class CreateDefectDto {
  @IsUUID() branchId!: string;
  @IsUUID() propertyId!: string;
  @IsOptional() @IsUUID() rentableSpaceId?: string;
  @IsOptional() @IsUUID() inspectionId?: string;
  @IsOptional() @IsUUID() inspectionItemId?: string;
  @IsString() @Length(3, 200) title!: string;
  @IsOptional() @IsString() @MaxLength(8000) description?: string;
  @IsString() @Length(2, 30) severity!: string;
}

export class DefectTransitionDto {
  @IsEnum(DefectStatus) status!: DefectStatus;
}

export class CreateDefectMaintenanceDto {
  @IsString() @Length(3, 200) title!: string;
  @IsString() @Length(3, 8000) description!: string;
  @IsString() @Length(2, 50) categoryCode!: string;
  @IsOptional() @IsEnum(MaintenancePriority) priority?: MaintenancePriority;
}
