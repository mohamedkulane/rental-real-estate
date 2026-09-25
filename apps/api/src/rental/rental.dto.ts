import {
  AgreementCommissionMethod,
  PartyKind,
  PropertyServiceIntent,
  PropertyType,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

/** Empty optional form fields arrive as "" from browsers; treat as omitted. */
const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === '' || value === null ? undefined : value;

export class RentalRoomInputDto {
  @IsString() @Length(1, 160) name!: string;
  @IsNumberString() monthlyRent!: string;
  @IsOptional() @IsString() @MaxLength(80) bathroomType?: string;
  @IsOptional() @IsNumberString() area?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class RentalUnitInputDto {
  @IsString() @Length(1, 160) name!: string;
  @ValidateIf((unit: RentalUnitInputDto) => (unit.rentMode ?? 'WHOLE') === 'WHOLE')
  @IsNumberString()
  monthlyRent?: string;
  @IsOptional() @IsIn(['WHOLE', 'BY_ROOMS']) rentMode?: 'WHOLE' | 'BY_ROOMS';
  @IsOptional() @IsString() @IsIn(['APARTMENT', 'ROOM', 'SHOP', 'OFFICE', 'OTHER', 'ENTIRE_PROPERTY'])
  typeCode?: 'APARTMENT' | 'ROOM' | 'SHOP' | 'OFFICE' | 'OTHER' | 'ENTIRE_PROPERTY';
  @IsOptional() @IsNumberString() bedrooms?: string;
  @IsOptional() @IsNumberString() bathrooms?: string;
  @IsOptional() @IsNumberString() area?: string;
  @IsOptional() @IsNumberString() floor?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @ValidateIf((unit: RentalUnitInputDto) => unit.rentMode === 'BY_ROOMS')
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => RentalRoomInputDto)
  rooms?: RentalRoomInputDto[];
}

export class BrokerageFeeInputDto {
  @IsIn(['OWNER', 'TENANT', 'SELLER', 'BUYER']) party!: 'OWNER' | 'TENANT' | 'SELLER' | 'BUYER';
  @IsIn(['FIXED', 'PERCENT']) method!: 'FIXED' | 'PERCENT';
  @IsNumberString() amount!: string;
}

export class AddRentalOwnerDto {
  @IsString() @Length(2, 240) name!: string;
  @IsString() @Length(5, 80) phone!: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsEnum(PartyKind) kind?: PartyKind;
}

export class AddRentalPropertyDto {
  @IsUUID() ownerPartyId!: string;
  @IsString() @Length(2, 200) name!: string;
  @IsEnum(PropertyType) propertyType!: PropertyType;
  @IsString() @Length(2, 100) location!: string;
  @IsNumberString() monthlyRent!: string;
  @IsOptional() @IsEnum(PropertyServiceIntent) serviceIntent?: PropertyServiceIntent;
  @IsOptional() @IsNumberString() askingPrice?: string;
  @ValidateIf((dto: AddRentalPropertyDto) => dto.serviceIntent === PropertyServiceIntent.FULL_MANAGEMENT)
  @IsNumberString()
  managementFeePercent?: string;
  @ValidateIf((dto: AddRentalPropertyDto) => dto.serviceIntent === PropertyServiceIntent.FULL_MANAGEMENT)
  @IsDateString({ strict: true })
  effectiveFrom?: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsString() @MaxLength(100) district?: string;
  @IsOptional() @IsString() @MaxLength(200) addressLine1?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsIn(['USD']) currency?: 'USD';
  @IsOptional() @IsIn(['false', 'true']) hasMultipleUnits?: 'false' | 'true';
  @IsOptional() @IsNumberString() bedrooms?: string;
  @IsOptional() @IsNumberString() bathrooms?: string;
  @IsOptional() @IsNumberString() area?: string;
  @IsOptional() @IsNumberString() landWidth?: string;
  @IsOptional() @IsNumberString() landLength?: string;
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => RentalUnitInputDto)
  units?: RentalUnitInputDto[];
}

/** Combined owner + property create for the primary Add Property task. */
export class AddOwnerAndPropertyDto {
  @IsString() @Length(2, 240) ownerName!: string;
  @IsString() @Length(5, 80) ownerPhone!: string;
  @IsOptional() @IsEnum(PartyKind) ownerKind?: PartyKind;
  @IsString() @Length(2, 200) name!: string;
  @IsEnum(PropertyType) propertyType!: PropertyType;
  @IsString() @Length(2, 100) location!: string;
  @ValidateIf(
    (dto: AddOwnerAndPropertyDto) =>
      (dto.serviceIntent ?? (dto.purpose === 'SALE' ? 'SALE' : 'RENTAL_BROKERAGE')) !== 'SALE' &&
      (dto.serviceIntent ?? (dto.purpose === 'SALE' ? 'SALE' : 'RENTAL_BROKERAGE')) !==
        'CONSTRUCTION',
  )
  @IsNumberString()
  monthlyRent?: string;
  @ValidateIf(
    (dto: AddOwnerAndPropertyDto) =>
      (dto.serviceIntent ?? (dto.purpose === 'SALE' ? 'SALE' : 'RENTAL_BROKERAGE')) === 'SALE',
  )
  @IsNumberString()
  askingPrice?: string;
  @IsOptional() @IsEnum(PropertyServiceIntent) serviceIntent?: PropertyServiceIntent;
  @IsOptional() @IsIn(['RENTAL', 'SALE']) purpose?: 'RENTAL' | 'SALE';
  @ValidateIf((dto: AddOwnerAndPropertyDto) => dto.serviceIntent === PropertyServiceIntent.FULL_MANAGEMENT)
  @IsNumberString()
  managementFeePercent?: string;
  @ValidateIf((dto: AddOwnerAndPropertyDto) => dto.serviceIntent === PropertyServiceIntent.FULL_MANAGEMENT)
  @IsDateString({ strict: true })
  effectiveFrom?: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsString() @MaxLength(100) district?: string;
  @IsOptional() @IsString() @MaxLength(200) addressLine1?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsIn(['USD']) currency?: 'USD';
  @IsOptional() @IsIn(['false', 'true']) hasMultipleUnits?: 'false' | 'true';
  @IsOptional() @IsNumberString() bedrooms?: string;
  @IsOptional() @IsNumberString() bathrooms?: string;
  @IsOptional() @IsNumberString() area?: string;
  @IsOptional() @IsNumberString() landWidth?: string;
  @IsOptional() @IsNumberString() landLength?: string;
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => RentalUnitInputDto)
  units?: RentalUnitInputDto[];
}

export class AddRentalCustomerDto {
  @IsString() @Length(1, 240) name!: string;
  @IsString() @Length(5, 80) phone!: string;
  @IsString() @Length(1, 100) propertyTypeWanted!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Length(1, 100, { each: true })
  preferredLocations!: string[];
  @IsNumberString() minRentBudget!: string;
  @IsNumberString() maxRentBudget!: string;
  @IsOptional() @IsUUID() @Transform(emptyToUndefined) branchId?: string;
  @IsOptional() @IsIn(['USD']) @Transform(emptyToUndefined) currency?: 'USD';
  @IsOptional()
  @Transform(emptyToUndefined)
  @ValidateIf((_, value) => value !== undefined)
  @IsEmail()
  @MaxLength(320)
  email?: string;
  @IsOptional() @IsNumberString() @Transform(emptyToUndefined) minBedrooms?: string;
  @IsOptional() @IsNumberString() @Transform(emptyToUndefined) minBathrooms?: string;
  @IsOptional() @IsNumberString() @Transform(emptyToUndefined) minArea?: string;
  @IsOptional() @IsString() @MaxLength(1000) @Transform(emptyToUndefined) notes?: string;
}

export class AddBuyerDto {
  @IsString() @Length(1, 240) name!: string;
  @IsString() @Length(5, 80) phone!: string;
  @IsString() @Length(1, 100) propertyTypeWanted!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Length(1, 100, { each: true })
  preferredLocations!: string[];
  @IsNumberString() minPurchaseBudget!: string;
  @IsNumberString() maxPurchaseBudget!: string;
  @IsOptional() @IsUUID() @Transform(emptyToUndefined) branchId?: string;
  @IsOptional() @IsIn(['USD']) @Transform(emptyToUndefined) currency?: 'USD';
  @IsOptional()
  @Transform(emptyToUndefined)
  @ValidateIf((_, value) => value !== undefined)
  @IsEmail()
  @MaxLength(320)
  email?: string;
  @IsOptional() @IsNumberString() @Transform(emptyToUndefined) minBedrooms?: string;
  @IsOptional() @IsNumberString() @Transform(emptyToUndefined) minBathrooms?: string;
  @IsOptional() @IsNumberString() @Transform(emptyToUndefined) minArea?: string;
  @IsOptional() @IsNumberString() @Transform(emptyToUndefined) landWidth?: string;
  @IsOptional() @IsNumberString() @Transform(emptyToUndefined) landLength?: string;
  @IsOptional() @IsString() @MaxLength(1000) @Transform(emptyToUndefined) notes?: string;
}

export class StartRentalBrokerageDto {
  @IsUUID() ownerPartyId!: string;
  @IsUUID() propertyId!: string;
  @IsNumberString() monthlyRent!: string;
  @IsOptional() @IsNumberString() commissionPercent?: string;
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => BrokerageFeeInputDto)
  fees?: BrokerageFeeInputDto[];
  @IsOptional() @IsUUID() rentableSpaceId?: string;
  @IsOptional() @IsIn(['USD']) currency?: 'USD';
  @IsOptional() @IsDateString({ strict: true }) effectiveFrom?: string;
}

export class StartFullManagementDto {
  @IsUUID() ownerPartyId!: string;
  @IsUUID() propertyId!: string;
  @IsNumberString() monthlyRent!: string;
  @IsNumberString() managementFeePercent!: string;
  @IsDateString({ strict: true }) startDate!: string;
  @IsOptional() @IsNumberString() tenantBrokerageFee?: string;
  @IsOptional() @IsIn(['FIXED', 'PERCENT']) tenantBrokerageMethod?: 'FIXED' | 'PERCENT';
  @IsOptional() @IsUUID() rentableSpaceId?: string;
  @IsOptional() @IsIn(['USD']) currency?: 'USD';
}

export class CreateRentalLeaseDto {
  /** Canonical path: the confirmed agreement is the source of truth for lease terms. */
  @IsOptional() @IsUUID() agreementId?: string;
  @ValidateIf((dto: CreateRentalLeaseDto) => !dto.agreementId) @IsUUID() leadId!: string;
  @ValidateIf((dto: CreateRentalLeaseDto) => !dto.agreementId) @IsUUID() propertyId!: string;
  @ValidateIf((dto: CreateRentalLeaseDto) => !dto.agreementId) @IsNumberString() monthlyRent!: string;
  @ValidateIf((dto: CreateRentalLeaseDto) => !dto.agreementId) @IsDateString({ strict: true }) leaseStartDate!: string;
  @ValidateIf((dto: CreateRentalLeaseDto) => !dto.agreementId && dto.leaseEndDate !== undefined)
  @IsDateString({ strict: true })
  leaseEndDate?: string;
  @IsOptional() @IsUUID() rentableSpaceId?: string;
  @IsOptional() @IsIn(['USD']) currency?: 'USD';
}

export class CommissionTermsDto {
  @IsEnum(AgreementCommissionMethod) method!: AgreementCommissionMethod;
  @IsNumberString() value!: string;
}

export class CreateRentalAgreementDto {
  @IsUUID() viewingId!: string;
  @IsUUID() leadId!: string;
  @IsUUID() propertyId!: string;
  @IsUUID() rentableSpaceId!: string;
  @IsDateString({ strict: true }) leaseStartDate!: string;
  @IsOptional() @IsDateString({ strict: true }) leaseEndDate?: string;
  @IsNumberString() finalRent!: string;
  @IsOptional() @IsNumberString() depositAmount?: string;
  @IsOptional() @ValidateNested() @Type(() => CommissionTermsDto) ownerCommission?: CommissionTermsDto;
  @IsOptional() @ValidateNested() @Type(() => CommissionTermsDto) tenantCommission?: CommissionTermsDto;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class CreateSaleAgreementDto {
  @IsUUID() viewingId!: string;
  @IsUUID() leadId!: string;
  @IsUUID() propertyId!: string;
  @IsNumberString() finalSalePrice!: string;
  @IsOptional() @ValidateNested() @Type(() => CommissionTermsDto) sellerCommission?: CommissionTermsDto;
  @IsOptional() @ValidateNested() @Type(() => CommissionTermsDto) buyerCommission?: CommissionTermsDto;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class AgreementTransitionDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsString() @Length(3, 500) reason!: string;
}
