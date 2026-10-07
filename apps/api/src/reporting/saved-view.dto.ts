import { IsObject, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class SavedViewQueryDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9-]{1,79}$/)
  workspace!: string;
}

export class CreateSavedViewDto extends SavedViewQueryDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsObject()
  filters!: Record<string, unknown>;
}

export class UpdateSavedViewDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;
}
