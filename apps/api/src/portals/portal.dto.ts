import { PortalType } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CursorPageQueryDto } from '../common/cursor-pagination';

export class PortalMaintenanceRequestDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  categoryCode?: string;

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

export class ReportExportQueryDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class GlobalSearchQueryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  q!: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}

export class NotificationMarkReadDto {
  @IsOptional()
  @IsString()
  notificationId?: string;
}

export class ListPortalAccountsQueryDto extends CursorPageQueryDto {
  @IsOptional()
  @IsEnum(PortalType)
  portalType?: PortalType;

  @IsOptional()
  @IsIn(['all', 'active', 'inactive'])
  status?: 'all' | 'active' | 'inactive';
}

export class CreatePortalAccountDto {
  @IsUUID()
  partyId!: string;

  @IsEnum(PortalType)
  portalType!: PortalType;

  @IsEmail()
  email!: string;

  @IsString()
  @Length(12, 128)
  password!: string;
}

export class ChangePortalAccountStatusDto {
  @IsBoolean()
  active!: boolean;

  @IsString()
  @Length(3, 255)
  reason!: string;
}
