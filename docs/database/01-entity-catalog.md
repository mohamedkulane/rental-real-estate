# Entity Catalog

## Core aggregates

| Context             | Aggregate roots                                                | Supporting entities                                                                                                                                                                          |
| ------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Organization/access | Company, Branch, Employee, Role, ApprovalPolicy                | Department, User, Permission, RolePermission, EmployeeRole, EmployeeBranchAssignment, ApprovalRule                                                                                           |
| Parties             | Party                                                          | PersonProfile, OrganizationProfile, OwnerProfile, TenantProfile, ApplicantProfile, VendorProfile, GuarantorProfile, PartyRelationship, Address, ContactPoint                                 |
| Portfolio           | Property, RentableSpace, ServiceEngagement                     | Building, PropertyBranchAssignment, PropertyOwnership, PropertyOwnerEntitlement, RentableSpaceType, RentableSpaceVersion, RentableSpaceParentHistory, Amenity, PropertyAmenity, SpaceAmenity |
| CRM/pipeline        | Lead, Listing, Application, Reservation, BrokerageDeal         | LeadPreference, LeadActivity, LeadAssignment, Inquiry, Viewing, ApplicationParty, ScreeningCheck, BrokerageDealParty                                                                         |
| Leasing             | Lease                                                          | LeaseParty, LeaseVersion, LeaseAmendment, LeaseRenewal, LeaseTermination, LeasePossession, MoveIn, MoveOut, KeyAssignment, MeterReading, RecurringChargeSchedule                             |
| Billing/payments    | Charge, Payment, Refund                                        | ChargeType, Invoice, InvoiceLine, CreditNote, Waiver, ChargeAdjustment, PaymentAllocation, PaymentReversal, TenantCredit                                                                     |
| Accounting          | Account, JournalEntry, FiscalYear, AccountingPeriod            | JournalLine, JournalSourceLink, IdempotencyRecord                                                                                                                                            |
| Owner accounting    | OwnerStatement, OwnerPayout                                    | OwnerStatementLine, OwnerPayableSnapshot, OwnerReserve, OwnerContributionRequest, OwnerPayoutLine, PayoutDestinationSnapshot, OwnerPayoutAttempt                                             |
| Deposits            | Deposit                                                        | DepositContributor, DepositTransaction, DepositSettlement, DepositDeduction, DepositDispute, DepositTransfer                                                                                 |
| Master/sublease     | MasterLease                                                    | MasterLeaseParty, MasterLeaseRentSchedule, MasterLeaseCharge; Lease links as sublease                                                                                                        |
| Utilities           | UtilityAccount, UtilityMeter, UtilityBill, UtilityAllocation   | UtilityAllocationRule, UtilityAllocationLine, UtilityAllocationInput, UtilityMeterReading                                                                                                    |
| Operations          | MaintenanceRequest, WorkOrder, Inspection                      | WorkOrderAssignment, Quotation, QuotationLine, Expense, ExpenseAllocation, VendorBill, VendorService, Asset, PreventiveMaintenancePlan, InspectionItem                                       |
| Content/control     | Document, Notification, ApprovalRequest, AuditLog, OutboxEvent | DocumentVersion, DocumentLink, NotificationDelivery, ApprovalStep, ApprovalDecision, InboxConsumption                                                                                        |

## Derived/read records

Availability, tenant balance, owner payable, receivables aging, rent roll, master-lease profitability, maintenance SLA, and dashboard projections are derived. OwnerStatement and owner payout calculation lines are justified immutable snapshots because they are issued/approved financial evidence.

## Reference data

RentableSpaceType, ChargeType, Permission, AccountType classification, utility types, expense categories, payment methods, amenities, and configurable legal/policy versions are reference/configuration data and are deactivated rather than routinely deleted.
