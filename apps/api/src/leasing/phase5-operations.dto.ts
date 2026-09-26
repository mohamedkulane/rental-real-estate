import {
  ApplicationStatus,
  LeasePartyRole,
  LeaseStatus,
  ListingStatus,
  MoveInStatus,
  RenewalStatus,
  ReservationStatus,
  ScreeningStatus,
  ViewingStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CursorPageQueryDto } from '../common/cursor-pagination';

export class ListingQueryDto extends CursorPageQueryDto {
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsEnum(ListingStatus) status?: ListingStatus;
}

export class CreateRentalListingDto {
  @IsUUID() rentableSpaceId!: string;
  @IsUUID() serviceEngagementId!: string;
  @IsString() @Length(2, 200) title!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsNumberString() askingRent?: string;
  @IsString() @Length(3, 3) currency!: string;
  @IsOptional() @IsDateString() availableFrom?: string;
}

export class CreateSaleListingDto {
  @IsUUID() propertyId!: string;
  @IsUUID() serviceEngagementId!: string;
  @IsString() @Length(2, 200) title!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsNumberString() askingPrice?: string;
  @IsString() @Length(3, 3) currency!: string;
}

export class VersionedTransitionDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsString() @Length(3, 500) reason!: string;
}

export class MatchListingsDto extends CursorPageQueryDto {
  @IsUUID() leadId!: string;
}

export class ViewingQueryDto extends CursorPageQueryDto {
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsEnum(ViewingStatus) status?: ViewingStatus;
  @IsOptional() @IsUUID() leadId?: string;
}

export class CreateViewingDto {
  @IsUUID() leadId!: string;
  @IsOptional() @IsUUID() rentalListingId?: string;
  @IsOptional() @IsUUID() saleListingId?: string;
  @IsOptional() @IsUUID() rentableSpaceId?: string;
  @IsUUID() assignedEmployeeId!: string;
  @IsDateString() scheduledAt!: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class RescheduleViewingDto extends VersionedTransitionDto {
  @IsDateString() scheduledAt!: string;
}

export class CompleteViewingDto extends VersionedTransitionDto {
  @IsEnum(ViewingStatus) status!: ViewingStatus;
  @IsOptional() @IsString() @MaxLength(1000) outcome?: string;
}

export class ApplicationQueryDto extends CursorPageQueryDto {
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsEnum(ApplicationStatus) status?: ApplicationStatus;
  @IsOptional() @IsEnum(ScreeningStatus) screeningStatus?: ScreeningStatus;
  @IsOptional() @IsUUID() leadId?: string;
}

export class CreateApplicationDto {
  @IsUUID() leadId!: string;
  @IsUUID() rentalListingId!: string;
  @IsOptional() @IsUUID() applicantPartyId?: string;
}

export class ApplicationTransitionDto extends VersionedTransitionDto {
  @IsEnum(ApplicationStatus) status!: ApplicationStatus;
}

export class RecordScreeningDto extends VersionedTransitionDto {
  @IsEnum(ScreeningStatus) screeningStatus!: ScreeningStatus;
  @IsOptional() @IsString() @MaxLength(2000) summary?: string;
}

export class ReservationQueryDto extends CursorPageQueryDto {
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsEnum(ReservationStatus) status?: ReservationStatus;
}

export class CreateReservationDto {
  @IsUUID() applicationId!: string;
  @IsDateString() startsAt!: string;
  @IsDateString() expiresAt!: string;
}

export class ReservationTransitionDto extends VersionedTransitionDto {
  @IsEnum(ReservationStatus) status!: ReservationStatus;
}

export class TenantQueryDto extends CursorPageQueryDto {}

export class ConvertTenantDto {
  @IsUUID() applicationId!: string;
}

export class LeasePartyInputDto {
  @IsUUID() partyId!: string;
  @IsEnum(LeasePartyRole) role!: LeasePartyRole;
}

export class LeaseQueryDto extends CursorPageQueryDto {
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsEnum(LeaseStatus) status?: LeaseStatus;
  @IsOptional() @IsUUID() rentableSpaceId?: string;
}

export class CreateLeaseDto {
  @IsUUID() applicationId!: string;
  @IsUUID() serviceEngagementId!: string;
  @IsDateString() leaseStartDate!: string;
  @IsDateString() leaseEndDate!: string;
  @IsNumberString() rentAmount!: string;
  @IsString() @Length(3, 3) currency!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => LeasePartyInputDto) parties!: LeasePartyInputDto[];
}

export class LeaseTransitionDto extends VersionedTransitionDto {
  @IsEnum(LeaseStatus) status!: LeaseStatus;
  @IsOptional() @IsString() @MaxLength(128) signatureHash?: string;
  @IsOptional() @IsUUID() documentId?: string;
}

export class MoveOutDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsDateString() moveOutDate!: string;
  @IsString() @Length(3, 500) reason!: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class RenewalQueryDto extends CursorPageQueryDto {
  @IsOptional() @IsEnum(RenewalStatus) status?: RenewalStatus;
}

export class CreateRenewalDto {
  @IsUUID() originalLeaseId!: string;
  @IsDateString() proposedStartDate!: string;
  @IsDateString() proposedEndDate!: string;
  @IsNumberString() proposedRent!: string;
  @IsString() @Length(3, 3) currency!: string;
}

export class RenewalTransitionDto extends VersionedTransitionDto {
  @IsEnum(RenewalStatus) status!: RenewalStatus;
}

export class MoveInQueryDto extends CursorPageQueryDto {
  @IsOptional() @IsEnum(MoveInStatus) status?: MoveInStatus;
}

export class ScheduleMoveInDto {
  @IsUUID() leaseId!: string;
  @IsDateString() scheduledDate!: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class MoveInTransitionDto extends VersionedTransitionDto {
  @IsEnum(MoveInStatus) status!: MoveInStatus;
  @IsOptional() @IsDateString() completedDate?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
