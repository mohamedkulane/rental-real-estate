import {
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateApprovalRequestDto {
  @IsUUID() policyId!: string;
  @IsString() @Length(2, 60) actionType!: string;
  @IsString() @Length(2, 60) targetType!: string;
  @IsUUID() targetId!: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsNumberString() amount?: string;
  @IsOptional() @IsString() @Length(3, 3) currency?: string;
}

export class DecideApprovalDto {
  @IsIn(['APPROVED', 'REJECTED']) outcome!: 'APPROVED' | 'REJECTED';
  @IsOptional() @IsString() @MaxLength(2000) reason?: string;
}
