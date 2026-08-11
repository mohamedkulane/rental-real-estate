# Enums and Statuses

## Core enums

- BranchAccessMode: `BRANCH`, `MULTI_BRANCH`, `COMPANY_WIDE`.
- PartyKind: `PERSON`, `ORGANIZATION`.
- ServiceModel: `BROKERAGE`, `TENANT_PLACEMENT`, `FULL_MANAGEMENT`, `MASTER_LEASE_SUBLEASE`, `RENT_COLLECTION_ONLY`, `COMPANY_OWNED`.
- ServiceEngagementStatus: `DRAFT`, `REVIEW`, `APPROVED`, `ACTIVE`, `SUSPENDED`, `TERMINATING`, `ENDED`, `REJECTED`, `CANCELLED`.
- OccupancyMode: `EXCLUSIVE` only in MVP; `SHARED` reserved for a later explicit model.
- ListingStatus, LeadStatus, ViewingStatus, ApplicationStatus, ReservationStatus, LeaseStatus follow the Step 3 state machines.
- PaymentStatus: `CAPTURED`, `VERIFYING`, `VERIFIED`, `POSTED`, `PARTIALLY_ALLOCATED`, `FULLY_ALLOCATED`, `REJECTED`, `REVERSED`.
- AccountingPeriodStatus: `OPEN`, `SOFT_CLOSED`, `CLOSED`, `LOCKED`.
- FundClass: `COMPANY_FUNDS`, `OWNER_FUNDS`, `SECURITY_DEPOSIT_FUNDS`, `TENANT_CREDIT_FUNDS`.
- JournalStatus: `DRAFT`, `POSTED`, `REVERSED`.
- DepositTransactionType: `RECEIPT`, `ADJUSTMENT`, `DEDUCTION`, `TRANSFER`, `REFUND`, `REVERSAL`.
- ApprovalStatus, MaintenanceStatus, WorkOrderStatus, ExpenseStatus, OwnerPayoutStatus mirror explicit state tables.
- UtilityAllocationMethod: `EQUAL`, `AREA_BASED`, `METERED`, `OCCUPANCY_BASED`, `FIXED_AMOUNT`, `CUSTOM_PERCENTAGE`.

## Enum policy

Use database enums only for stable closed technical/state vocabularies. Business-configurable categories such as charge types, space types, expense categories, payment methods, utility types, permitted land uses, and amenities are tables with codes/effective activity. Adding a state requires a transition review and migration; display labels/localization are not enum values.

Complete proposed enum definitions are in `prisma/design/enums.prisma.md` and `schema-proposed.prisma`.
