import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export class CreateRoleDto {
  @IsString() @Length(2, 64) code!: string;
  @IsString() @Length(2, 120) name!: string;
}

export class UpdateRoleDto {
  @IsOptional() @IsString() @Length(2, 120) name?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() @Length(3, 255) reason?: string;
}

export class PermissionGrantDto {
  @IsUUID() permissionId!: string;
}

export class ReasonDto {
  @IsString() @Length(3, 255) reason!: string;
}

export class UpdateUserPrivilegesDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  permissionIds!: string[];

  @IsString()
  @Length(3, 255)
  reason!: string;
}
