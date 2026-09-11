import {
  BrokerageDealStatus,
  ExpenseResponsibility,
  ExpenseStatus,
  InvoiceStatus,
  JournalStatus,
  PaymentStatus,
  PayoutStatus,
  SaleOfferStatus,
  SaleSettlementStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CursorPageQueryDto } from '../common/cursor-pagination';

export class FinanceBranchQueryDto extends CursorPageQueryDto {
  @IsOptional() @IsUUID() branchId?: string;
}

export class BillingScheduleQueryDto extends FinanceBranchQueryDto {
  @IsOptional() @IsUUID() serviceEngagementId?: string;
  @IsOptional() @IsUUID() leaseId?: string;
}

export class CreateBillingScheduleDto {
  @IsUUID() serviceEngagementId!: string;
  @IsUUID() leaseId!: string;
  @IsUUID() chargeTypeId!: string;
  @IsInt() @Min(1) @Max(28) billingDayOfMonth!: number;
  @IsString() @Length(3, 3) currency!: string;
  @IsNumberString() amount!: string;
  @IsDateString() effectiveFrom!: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
}

export class RunBillingDto {
  @IsOptional() @IsDateString() runDate?: string;
  @IsOptional() @IsUUID() billingScheduleId?: string;
}

export class ChargeQueryDto extends FinanceBranchQueryDto {
  @IsOptional() @IsUUID() leaseId?: string;
  @IsOptional() @IsUUID() debtorPartyId?: string;
}

export class InvoiceQueryDto extends FinanceBranchQueryDto {
  @IsOptional() @IsEnum(InvoiceStatus) status?: InvoiceStatus;
  @IsOptional() @IsUUID() debtorPartyId?: string;
}

export class IssueInvoiceDto {
  @IsUUID() debtorPartyId!: string;
  @IsArray() @ArrayMinSize(1) @IsUUID('all', { each: true }) chargeIds!: string[];
  @IsDateString() issueDate!: string;
  @IsDateString() dueDate!: string;
  @IsString() @Length(3, 3) currency!: string;
}

export class PaymentQueryDto extends FinanceBranchQueryDto {
  @IsOptional() @IsEnum(PaymentStatus) status?: PaymentStatus;
  @IsOptional() @IsUUID() payerPartyId?: string;
}

export class CreatePaymentDto {
  @IsUUID() branchId!: string;
  @IsUUID() payerPartyId!: string;
  @IsUUID() methodId!: string;
  @IsUUID() receivingAccountId!: string;
  @IsString() @Length(3, 3) currency!: string;
  @IsNumberString() amount!: string;
  @IsDateString() receivedAt!: string;
  @IsOptional() @IsString() @MaxLength(160) externalRef?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional() @IsString() @MaxLength(160) idempotencyKey?: string;
  @IsOptional() @IsBoolean() autoCapture?: boolean;
}

export class PaymentAllocationLineDto {
  @IsUUID() chargeId!: string;
  @IsNumberString() amount!: string;
}

export class AllocatePaymentDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => PaymentAllocationLineDto)
  allocations!: PaymentAllocationLineDto[];
}

export class ExpenseQueryDto extends FinanceBranchQueryDto {
  @IsOptional() @IsEnum(ExpenseStatus) status?: ExpenseStatus;
  @IsOptional() @IsUUID() propertyId?: string;
}

export class CreateExpenseDto {
  @IsUUID() branchId!: string;
  @IsOptional() @IsUUID() vendorPartyId?: string;
  @IsOptional() @IsUUID() propertyId?: string;
  @IsOptional() @IsUUID() rentableSpaceId?: string;
  @IsOptional() @IsUUID() ownerPartyId?: string;
  @IsOptional() @IsUUID() leaseId?: string;
  @IsOptional() @IsUUID() serviceEngagementId?: string;
  @IsString() @Length(2, 50) categoryCode!: string;
  @IsString() @Length(3, 3) currency!: string;
  @IsNumberString() amount!: string;
  @IsEnum(ExpenseResponsibility) responsibility!: ExpenseResponsibility;
  @IsDateString() businessDate!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
}

export class ExpenseTransitionDto {
  @IsEnum(ExpenseStatus) status!: ExpenseStatus;
  @IsString() @Length(3, 500) reason!: string;
}

export class OwnerPayoutQueryDto extends FinanceBranchQueryDto {
  @IsOptional() @IsUUID() ownerPartyId?: string;
  @IsOptional() @IsEnum(PayoutStatus) status?: PayoutStatus;
}

export class CreateOwnerPayoutDto {
  @IsUUID() propertyId!: string;
  @IsUUID() serviceEngagementId!: string;
  @IsDateString() periodStart!: string;
  @IsDateString() periodEnd!: string;
  @IsString() @Length(3, 3) currency!: string;
  @IsOptional() @IsNumberString() otherDeductions?: string;
}

export class OwnerPayoutTransitionDto {
  @IsEnum(PayoutStatus) status!: PayoutStatus;
  @IsString() @Length(3, 500) reason!: string;
}

export class JournalQueryDto extends FinanceBranchQueryDto {
  @IsOptional() @IsEnum(JournalStatus) status?: JournalStatus;
}

export class JournalLineInputDto {
  @IsUUID() accountId!: string;
  @IsNumberString() signedAmount!: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsUUID() propertyId?: string;
  @IsOptional() @IsUUID() rentableSpaceId?: string;
  @IsOptional() @IsUUID() ownerPartyId?: string;
  @IsOptional() @IsUUID() tenantPartyId?: string;
  @IsOptional() @IsUUID() leaseId?: string;
  @IsOptional() @IsUUID() vendorPartyId?: string;
  @IsOptional() @IsUUID() serviceEngagementId?: string;
}

export class CreateJournalDto {
  @IsOptional() @IsUUID() branchId?: string;
  @IsDateString() businessDate!: string;
  @IsString() @Length(3, 3) currency!: string;
  @IsString() @Length(3, 300) description!: string;
  @IsArray() @ArrayMinSize(2) @ValidateNested({ each: true }) @Type(() => JournalLineInputDto)
  lines!: JournalLineInputDto[];
}

export class ReverseJournalDto {
  @IsString() @Length(3, 500) reason!: string;
  @IsOptional() @IsDateString() businessDate?: string;
}

export class BrokerageDealQueryDto extends FinanceBranchQueryDto {
  @IsOptional() @IsEnum(BrokerageDealStatus) status?: BrokerageDealStatus;
}

export class CreateBrokerageDealDto {
  @IsUUID() serviceEngagementId!: string;
  @IsUUID() rentableSpaceId!: string;
  @IsOptional() @IsUUID() leaseId?: string;
  @IsOptional() @IsUUID() leadId?: string;
  @IsOptional() @IsUUID() viewingId?: string;
  @IsOptional() @IsUUID() rentalApplicationId?: string;
  @IsNumberString() grossCommission!: string;
  @IsOptional() @IsNumberString() rentBasis?: string;
  @IsOptional() @IsNumberString() agentCommission?: string;
  @IsString() @Length(3, 3) currency!: string;
  @IsOptional() @IsString() @MaxLength(160) idempotencyKey?: string;
}

export class BrokerageDealTransitionDto {
  @IsEnum(BrokerageDealStatus) status!: BrokerageDealStatus;
  @IsString() @Length(3, 500) reason!: string;
}

export class SaleOfferQueryDto extends FinanceBranchQueryDto {
  @IsOptional() @IsEnum(SaleOfferStatus) status?: SaleOfferStatus;
  @IsOptional() @IsUUID() propertyId?: string;
}

export class CreateSaleOfferDto {
  @IsUUID() serviceEngagementId!: string;
  @IsUUID() propertyId!: string;
  @IsOptional() @IsUUID() saleListingId?: string;
  @IsOptional() @IsUUID() leadId?: string;
  @IsOptional() @IsUUID() buyerPartyId?: string;
  @IsNumberString() offerAmount!: string;
  @IsString() @Length(3, 3) currency!: string;
  @IsDateString() offerDate!: string;
  @IsOptional() @IsDateString() expiresAt?: string;
  @IsOptional() @IsString() @MaxLength(2000) termsNotes?: string;
}

export class SaleOfferTransitionDto {
  @IsEnum(SaleOfferStatus) status!: SaleOfferStatus;
  @IsString() @Length(3, 500) reason!: string;
  @IsOptional() @IsNumberString() counterAmount?: string;
}

export class SaleSettlementQueryDto extends FinanceBranchQueryDto {
  @IsOptional() @IsEnum(SaleSettlementStatus) status?: SaleSettlementStatus;
}

export class CreateSaleSettlementDto {
  @IsUUID() saleOfferId!: string;
  @IsNumberString() salePrice!: string;
  @IsOptional() @IsNumberString() approvedDeductions?: string;
  @IsOptional() @IsDateString() closingDate?: string;
  @IsOptional() @IsString() @MaxLength(160) idempotencyKey?: string;
}

export class SaleSettlementTransitionDto {
  @IsEnum(SaleSettlementStatus) status!: SaleSettlementStatus;
  @IsString() @Length(3, 500) reason!: string;
}
