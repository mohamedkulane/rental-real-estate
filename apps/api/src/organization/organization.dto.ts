import { BranchAccessMode, UserStatus } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

export class UpdateCompanyDto {
  @IsOptional() @IsString() @MaxLength(240) legalName?: string;
  @IsOptional() @IsString() @MaxLength(200) displayName?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsObject() address?: Record<string, unknown>;
  @IsOptional() @IsString() @Length(3, 3) defaultCurrency?: string;
  @IsOptional() @IsString() @MaxLength(64) timezone?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class CreateBranchDto {
  @IsOptional() @IsString() @Length(2, 32) code?: string;
  @IsString() @Length(2, 160) name!: string;
  @IsOptional() @IsObject() address?: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsEmail() email?: string;
}

export class UpdateBranchDto {
  @IsOptional() @IsString() @Length(2, 160) name?: string;
  @IsOptional() @IsObject() address?: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class CreateEmployeeDto {
  @IsOptional() @IsString() @Length(2, 40) employeeNumber?: string;
  @IsString() @Length(2, 240) displayName!: string;
  @IsEnum(BranchAccessMode) accessMode!: BranchAccessMode;
  @IsUUID() branchId!: string;
  @IsOptional() @IsString() @MaxLength(120) jobTitle?: string;
  @IsOptional() @IsDateString() hireDate?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @Length(12, 128) password?: string;
}

export class UpdateEmployeeDto {
  @IsOptional() @IsString() @Length(2, 240) displayName?: string;
  @IsOptional() @IsEnum(BranchAccessMode) accessMode?: BranchAccessMode;
  @IsOptional() @IsString() @MaxLength(120) jobTitle?: string;
  @IsOptional() @IsDateString() hireDate?: string;
}

export class ChangeEmployeeStatusDto {
  @IsBoolean() active!: boolean;
  @IsString() @Length(3, 255) reason!: string;
}

export class AssignBranchDto {
  @IsUUID() branchId!: string;
  @IsDateString() effectiveFrom!: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
}

export class AssignRoleDto {
  @IsUUID() roleId!: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsDateString() effectiveFrom!: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
}

export class CreateUserDto {
  @IsUUID() employeeId!: string;
  @IsEmail() email!: string;
  @IsString() @Length(12, 128) password!: string;
}

export class ChangeUserStatusDto {
  @IsEnum(UserStatus) status!: UserStatus;
  @IsString() @Length(3, 255) reason!: string;
}
