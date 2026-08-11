# Maintenance and Vendor Model

Vendor identity is a company-level Party with VendorProfile. VendorService records approved categories/effective status. MaintenanceRequest targets Property and optionally RentableSpace/Asset, cites ServiceEngagement capability, and owns triage, priority, responsibility, SLA, access, and lifecycle.

WorkOrder owns approved scope, vendor/internal assignment, schedule, amount ceiling, status, and evidence. WorkOrderAssignment supports people/vendor participants. Quotation/QuotationLine preserves competing offers and approved selection. Inspection/InspectionItem stores structured condition evidence without requiring residential fields for land.

Expense is the recognized economic cost and Finance posting source. VendorBill is the supplier payable document and may recognize or match one/more Expenses; it is not a second independent expense. ExpenseAllocation distributes one expense across property/space/owner/company responsibility using explicit lines. Payment status belongs to payable/payment flows, not duplicated mutable bill flags.

Asset and PreventiveMaintenancePlan are included only where operationally enabled. Maintenance eligibility is resolved from ServiceEngagement; land defaults off. Completion, bill approval, expense recognition, and outbox publication use controlled transactions and maker-checker thresholds.
