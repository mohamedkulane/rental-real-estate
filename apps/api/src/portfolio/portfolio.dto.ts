import {
  AreaUnit,
  BuildingStatus,
  OwnerStatus,
  PartyKind,
  PropertyType,
  PropertyStatus,
  RentableSpaceStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import { CursorPageQueryDto } from '../common/cursor-pagination';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ContactInputDto {
  @IsIn(['PHONE', 'WHATSAPP', 'EMAIL']) type!: 'PHONE' | 'WHATSAPP' | 'EMAIL';
  @IsString() @Length(3, 320) value!: string;
  @IsOptional() @IsBoolean() primary?: boolean;
}

export class AddressInputDto {
  @IsOptional() @IsString() @MaxLength(30) type?: string;
  @IsString() @Length(2, 200) line1!: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsString() @Length(2, 2) countryCode!: string;
}

export class PersonInputDto {
  @IsString() @Length(1, 120) givenName!: string;
  @IsString() @Length(1, 120) familyName!: string;
  @IsOptional() @IsString() @MaxLength(120) preferredName?: string;
  @IsOptional() @IsDateString() birthDate?: string;
  @IsOptional() @IsString() @Length(2, 2) nationalityCode?: string;
}

export class OrganizationInputDto {
  @IsString() @Length(2, 240) legalName!: string;
  @IsOptional() @IsString() @MaxLength(240) tradingName?: string;
  @IsOptional() @IsString() @MaxLength(100) registrationNumber?: string;
  @IsOptional() @IsString() @MaxLength(200) contactPersonName?: string;
}

export class CreatePartyDto {
  @IsOptional() @IsString() @Length(2, 40) partyNumber?: string;
  @IsUUID() branchId!: string;
  @IsEnum(PartyKind) kind!: PartyKind;
  @IsString() @Length(2, 240) displayName!: string;
  @IsOptional() @ValidateNested() @Type(() => PersonInputDto) person?: PersonInputDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => OrganizationInputDto)
  organization?: OrganizationInputDto;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ContactInputDto)
  contacts?: ContactInputDto[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => AddressInputDto)
  addresses?: AddressInputDto[];
}

export class UpdatePartyDto {
  @IsOptional() @IsString() @Length(2, 240) displayName?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @ValidateNested() @Type(() => PersonInputDto) person?: PersonInputDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => OrganizationInputDto)
  organization?: OrganizationInputDto;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ContactInputDto)
  contacts?: ContactInputDto[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => AddressInputDto)
  addresses?: AddressInputDto[];
}

export class CreateOwnerDto {
  @IsUUID() partyId!: string;
  @IsOptional() @IsString() @Length(2, 40) ownerNumber?: string;
  @IsOptional() @IsEnum(OwnerStatus) status?: OwnerStatus;
  @IsOptional() @IsString() @MaxLength(30) communicationPreference?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class UpdateOwnerDto {
  @IsOptional() @IsEnum(OwnerStatus) status?: OwnerStatus;
  @IsOptional() @IsString() @MaxLength(30) communicationPreference?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class ListPartiesQueryDto extends CursorPageQueryDto {
  @IsOptional() @IsEnum(PartyKind) kind?: PartyKind;
  @IsOptional() @IsIn(['true', 'false']) active?: 'true' | 'false';
}

export class ListOwnersQueryDto extends CursorPageQueryDto {
  @IsOptional() @IsEnum(OwnerStatus) status?: OwnerStatus;
  @IsOptional() @IsEnum(PartyKind) partyKind?: PartyKind;
}

export class ListPropertiesQueryDto extends CursorPageQueryDto {
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsEnum(PropertyType) propertyType?: PropertyType;
  @IsOptional() @IsEnum(PropertyStatus) status?: PropertyStatus;
  @IsOptional() @IsIn(['NEWEST', 'NAME', 'CODE']) sort?: 'NEWEST' | 'NAME' | 'CODE';
}

export class CreatePropertyDto {
  @IsOptional() @IsString() @Length(2, 40) propertyCode?: string;
  @IsString() @Length(2, 200) name!: string;
  @IsEnum(PropertyType) propertyType!: PropertyType;
  @IsUUID() branchId!: string;
  @IsDateString() effectiveFrom!: string;
  @IsString() @Length(2, 100) city!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(200) addressLine1?: string;
  @IsOptional() @IsString() @MaxLength(100) district?: string;
  @IsOptional() @IsString() @MaxLength(100) neighborhood?: string;
  @IsOptional() @IsString() @MaxLength(200) landmark?: string;
  @IsOptional() @IsNumberString() latitude?: string;
  @IsOptional() @IsNumberString() longitude?: string;
  @IsOptional() @IsNumberString() plotArea?: string;
  @IsOptional() @IsEnum(AreaUnit) plotAreaUnit?: AreaUnit;
}

export class UpdatePropertyDto {
  @IsOptional() @IsString() @Length(2, 200) name?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(200) addressLine1?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MaxLength(100) district?: string;
  @IsOptional() @IsString() @MaxLength(100) neighborhood?: string;
  @IsOptional() @IsString() @MaxLength(200) landmark?: string;
}

export class PropertyLifecycleTransitionDto {
  @IsString() @Length(3, 500) reason!: string;
  @IsOptional() @IsDateString() effectiveDate?: string;
}
export class DiscardPropertyDraftDto {
  @IsString() @Length(3, 500) reason!: string;
}

export class TransferPropertyBranchDto {
  @IsUUID() branchId!: string;
  @IsDateString() effectiveFrom!: string;
  @IsString() @Length(3, 500) reason!: string;
}

export class OwnershipShareDto {
  @IsUUID() ownerPartyId!: string;
  @IsNumberString() ownershipPercent!: string;
  @IsNumberString() payoutPercent!: string;
}

export class ReplaceOwnershipDto {
  @IsDateString() effectiveFrom!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => OwnershipShareDto)
  shares!: OwnershipShareDto[];
  @IsString() @Length(3, 500) reason!: string;
}

export class CreateBuildingDto {
  @IsOptional() @IsString() @Length(1, 40) buildingCode?: string;
  @IsString() @Length(2, 160) name!: string;
  @IsOptional() @IsInt() @Min(0) @Max(500) numberOfFloors?: number;
  @IsOptional() @IsObject() attributes?: Record<string, unknown>;
  @IsOptional() @IsEnum(BuildingStatus) status?: BuildingStatus;
}

export class UpdateBuildingDto {
  @IsOptional() @IsString() @Length(2, 160) name?: string;
  @IsOptional() @IsInt() @Min(0) @Max(500) numberOfFloors?: number;
  @IsOptional() @IsObject() attributes?: Record<string, unknown>;
}

export class BuildingLifecycleDto {
  @IsEnum(BuildingStatus) status!: BuildingStatus;
  @IsString() @Length(3, 500) reason!: string;
}
export class LandProfileDto {
  @IsString() @Length(2, 200) permittedUse!: string;
  @IsOptional() @IsString() @MaxLength(160) dimensions?: string;
  @IsOptional() @IsString() @MaxLength(200) currentUse?: string;
  @IsOptional() @IsString() @MaxLength(2000) boundaryDescription?: string;
  @IsOptional() @IsString() @MaxLength(200) roadAccess?: string;
  @IsOptional() @IsBoolean() fenced?: boolean;
}

export class ResidentialProfileDto {
  @IsOptional() @IsInt() @Min(0) bedrooms?: number;
  @IsOptional() @IsNumberString() bathrooms?: string;
  @IsOptional() @IsInt() @Min(0) kitchens?: number;
  @IsOptional() @IsInt() @Min(0) livingRooms?: number;
  @IsOptional() @IsInt() @Min(0) balconies?: number;
  @IsOptional() @IsString() @MaxLength(30) furnishedStatus?: string;
}

export class CommercialProfileDto {
  @IsOptional() @IsNumberString() frontageMeters?: string;
  @IsOptional() @IsString() @MaxLength(60) classification?: string;
}

export class CreateSpaceDto {
  @IsUUID() propertyId!: string;
  @IsOptional() @IsUUID() buildingId?: string;
  @IsOptional() @IsUUID() parentSpaceId?: string;
  @IsString() @Length(1, 50) typeCode!: string;
  @IsOptional() @IsString() @Length(1, 50) spaceCode?: string;
  @IsString() @Length(2, 160) name!: string;
  @IsOptional() @IsEnum(RentableSpaceStatus) status?: RentableSpaceStatus;
  @IsDateString() effectiveFrom!: string;
  @IsOptional() @IsNumberString() usableArea?: string;
  @IsOptional() @IsNumberString() totalArea?: string;
  @IsOptional() @IsEnum(AreaUnit) areaUnit?: AreaUnit;
  @IsOptional() @IsInt() floorNumber?: number;
  @IsOptional() @IsInt() @Min(0) capacity?: number;
  @IsOptional() @ValidateNested() @Type(() => LandProfileDto) land?: LandProfileDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => ResidentialProfileDto)
  residential?: ResidentialProfileDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => CommercialProfileDto)
  commercial?: CommercialProfileDto;
}

export class PartitionChildDto {
  @IsString() @Length(1, 50) typeCode!: string;
  @IsOptional() @IsString() @Length(1, 50) spaceCode?: string;
  @IsString() @Length(2, 160) name!: string;
  @IsNumberString() usableArea!: string;
  @IsOptional() @IsNumberString() totalArea?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => CommercialProfileDto)
  commercial?: CommercialProfileDto;
}

export class PartitionSpaceDto {
  @IsDateString() effectiveFrom!: string;
  @IsEnum(AreaUnit) areaUnit!: AreaUnit;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PartitionChildDto)
  children!: PartitionChildDto[];
  @IsString() @Length(3, 500) reason!: string;
}

export class CorrectMeasurementDto {
  @IsDateString() effectiveFrom!: string;
  @IsNumberString() usableArea!: string;
  @IsOptional() @IsNumberString() totalArea?: string;
  @IsEnum(AreaUnit) areaUnit!: AreaUnit;
  @IsString() @Length(3, 500) reason!: string;
}

export class ReparentSpaceDto {
  @IsUUID() parentSpaceId!: string;
  @IsDateString() effectiveFrom!: string;
  @IsString() @Length(3, 500) reason!: string;
}

export class RetireSpaceDto {
  @IsDateString() effectiveDate!: string;
  @IsString() @Length(3, 500) reason!: string;
}

export class AmenityAssignmentDto {
  @IsUUID() amenityId!: string;
}

export class CreateAmenityDto {
  @IsString() @Length(2, 50) code!: string;
  @IsString() @Length(2, 100) name!: string;
}

export class UpdateAmenityDto {
  @IsOptional() @IsString() @Length(2, 100) name?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UploadDocumentDto {
  @IsString() @Length(2, 240) title!: string;
  @IsIn([
    'TITLE_DEED',
    'OWNERSHIP_CERTIFICATE',
    'SURVEY',
    'PLAN',
    'REGISTRATION_DOCUMENT',
    'IDENTIFICATION',
    'OTHER',
  ])
  categoryCode!: string;
  @IsIn(['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED']) accessClass!: string;
  @IsIn(['Property', 'RentableSpace', 'Owner']) entityType!: 'Property' | 'RentableSpace' | 'Owner';
  @IsUUID() entityId!: string;
  @IsString() @Length(2, 50) purpose!: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class DocumentContentQueryDto {
  @IsOptional() @IsIn(['inline', 'attachment']) disposition: 'inline' | 'attachment' = 'inline';
}

export class CreateDocumentMetadataDto {
  @IsOptional() @IsString() @Length(2, 240) displayName?: string;
  @IsString() @Length(2, 50) categoryCode!: string;
  @IsIn(['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED']) accessClass!: string;
  @IsIn(['PENDING', 'ACTIVE', 'ARCHIVED']) status!: string;
  @IsString() @Length(3, 512) storageKey!: string;
  @IsString() @Length(16, 128) checksum!: string;
  @IsString() @Length(3, 160) mimeType!: string;
  @IsInt() @Min(1) sizeBytes!: number;
  @IsIn(['Property', 'RentableSpace', 'Owner']) entityType!: 'Property' | 'RentableSpace' | 'Owner';
  @IsUUID() entityId!: string;
  @IsString() @Length(2, 50) purpose!: string;
}

export class UpdateDocumentMetadataDto {
  @IsOptional() @IsString() @Length(2, 240) displayName?: string;
  @IsOptional() @IsString() @Length(2, 50) categoryCode?: string;
  @IsOptional() @IsIn(['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED']) accessClass?: string;
  @IsOptional() @IsIn(['PENDING', 'ACTIVE', 'ARCHIVED']) status?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class ListDocumentsQueryDto extends CursorPageQueryDto {
  @IsOptional()
  @IsIn(['Property', 'RentableSpace', 'Owner'])
  entityType?: 'Property' | 'RentableSpace' | 'Owner';
  @IsOptional() @IsUUID() entityId?: string;
  @IsOptional() @IsString() @MaxLength(120) entitySearch?: string;
  @IsOptional() @IsString() @MaxLength(50) categoryCode?: string;
  @IsOptional() @IsIn(['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED']) accessClass?: string;
  @IsOptional() @IsIn(['PENDING', 'ACTIVE', 'ARCHIVED']) status?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class ListPropertyBranchHistoryQueryDto extends CursorPageQueryDto {
  @IsOptional() @IsUUID() propertyId?: string;
  @IsOptional() @IsString() @MaxLength(120) propertySearch?: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsString() @MaxLength(120) branchSearch?: string;
  @IsOptional() @IsIn(['CURRENT', 'HISTORICAL', 'SCHEDULED']) period?:
    'CURRENT' | 'HISTORICAL' | 'SCHEDULED';
}

export class ListPropertyActivityQueryDto extends CursorPageQueryDto {
  @IsOptional() @IsUUID() propertyId?: string;
  @IsOptional() @IsString() @MaxLength(120) propertySearch?: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsString() @MaxLength(120) branchSearch?: string;
  @IsOptional() @IsString() @MaxLength(100) action?: string;
}
export class ListPropertyOwnershipsQueryDto extends CursorPageQueryDto {
  @IsOptional() @IsUUID() propertyId?: string;
  @IsOptional() @IsString() @MaxLength(120) propertySearch?: string;
  @IsOptional() @IsUUID() ownerPartyId?: string;
  @IsOptional() @IsString() @MaxLength(120) ownerSearch?: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsString() @MaxLength(120) branchSearch?: string;
  @IsOptional() @IsIn(['CURRENT', 'SCHEDULED', 'HISTORICAL']) period?:
    'CURRENT' | 'SCHEDULED' | 'HISTORICAL';
}
export class ListBuildingActivityQueryDto extends CursorPageQueryDto {}

export class ListBuildingsQueryDto extends CursorPageQueryDto {
  @IsOptional() @IsUUID() propertyId?: string;
  @IsOptional() @IsString() @MaxLength(120) propertySearch?: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsString() @MaxLength(120) branchSearch?: string;
  @IsOptional() @IsEnum(BuildingStatus) status?: BuildingStatus;
}

export class ListPropertyAmenitiesQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @IsString() @MaxLength(100) cursor?: string;
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsUUID() propertyId?: string;
  @IsOptional() @IsString() @MaxLength(120) propertySearch?: string;
  @IsOptional() @IsUUID() amenityId?: string;
  @IsOptional() @IsString() @MaxLength(120) amenitySearch?: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsString() @MaxLength(120) branchSearch?: string;
}
export class ListSpaceMeasurementsQueryDto extends CursorPageQueryDto {
  @IsOptional() @IsUUID() propertyId?: string;
  @IsOptional() @IsString() @MaxLength(120) propertySearch?: string;
  @IsOptional() @IsString() @MaxLength(120) buildingSearch?: string;
  @IsOptional() @IsIn(['CURRENT', 'HISTORICAL', 'ALL']) period: 'CURRENT' | 'HISTORICAL' | 'ALL' =
    'CURRENT';
}
export class ListSpacesQueryDto extends CursorPageQueryDto {
  @IsOptional() @IsUUID() propertyId?: string;
  @IsOptional() @IsString() @MaxLength(120) propertySearch?: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsString() @MaxLength(120) branchSearch?: string;
  @IsOptional() @IsUUID() buildingId?: string;
  @IsOptional() @IsString() @MaxLength(120) buildingSearch?: string;
  @IsOptional() @IsString() @Length(1, 50) typeCode?: string;
  @IsOptional() @IsString() @MaxLength(120) typeSearch?: string;
  @IsOptional() @IsEnum(RentableSpaceStatus) status?: RentableSpaceStatus;
}
