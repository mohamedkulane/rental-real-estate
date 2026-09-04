import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { WorkflowStatus, WorkflowType } from '@prisma/client';

export class CreateWorkflowDraftDto {
  @IsUUID() branchId!: string;
  @IsEnum(WorkflowType) type!: WorkflowType;
  @IsOptional() @IsInt() @Min(1) @Max(8) currentStep = 1;
  @IsOptional() @IsInt() @Min(1) @Max(1) payloadSchemaVersion = 1;
  @IsObject() payload!: Record<string, unknown>;
}

export class UpdateWorkflowDraftDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsInt() @Min(1) @Max(8) currentStep!: number;
  @IsObject() payload!: Record<string, unknown>;
}

export class CancelWorkflowDraftDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsString() @MaxLength(500) reason!: string;
}

export class CompleteWorkflowDraftDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsString() @MaxLength(120) idempotencyKey!: string;
  @IsString() @MaxLength(64) requestHash!: string;
}

export class ListWorkflowDraftsDto {
  @IsOptional() @IsEnum(WorkflowType) type?: WorkflowType;
  @IsOptional() @IsEnum(WorkflowStatus) status?: WorkflowStatus;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsUUID() cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 20;
}
