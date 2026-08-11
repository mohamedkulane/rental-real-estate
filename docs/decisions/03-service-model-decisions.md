# Service Model Decisions

## Status

The core service-model catalog and default capability boundaries are approved. Engagement scope inheritance, transitions, optional additions, and detailed commercial policies remain open.

## Governing principle

Capabilities are driven by an effective service engagement, not by RentableSpace type or a UI selection alone. Each engagement must define the applicable property/space scope, model, effective period, authorizing agreement, and explicitly enabled optional services.

## Approved models

### Brokerage

Brokerage is a one-time transaction ending in a confirmed deal, commission accounting, `RENTED_EXTERNAL`, unavailable listing, and closed deal. It does not create recurring rent, recurring tenant-ledger management, owner payout cycles, managed maintenance, or ongoing management workflows.

### Tenant placement only

Tenant placement is owner-engaged sourcing and placement: engagement, listing, lead generation, viewing, screening, placement, fee, handoff, and closure. Recurring management does not continue after handoff unless a new service engagement is activated.

### Full management

Full management enables ongoing lease administration, recurring billing, payment allocation, deposits, maintenance where contracted, company fee calculation, owner accounting, statements, and owner payouts.

### Rent collection only

Rent collection only enables configured recurring tenant charges, collection, allocation, tenant balances, collection fee, owner payable, and owner payout. It does not automatically enable maintenance, full leasing operations, or other full-management capabilities. Any addition must be explicitly enabled by the engagement.

### Master lease/sublease

The company is principal tenant under the master lease and landlord-side party under subleases. This model enables master obligations, sublease billing/collection, shared-cost allocation, child-space occupancy, and margin reporting. It does not use full-management owner-payable processing.

### Company-owned

The company owns the property and retains rent/property income. Normal external owner payable does not apply. Leasing, billing, deposits, and property operations may otherwise be enabled.

### Maintenance only

Maintenance-only may be introduced as an optional/future engagement. It is not part of the initial MVP unless a separately approved requirement brings it into scope. It never implies rent collection or lease administration.

## Physical specializations

Vacant land, commercial spaces, residential spaces, parking, and storage are physical RentableSpace specializations. They influence fields, validation, pricing options, documents, and default capabilities but do not replace the service model.

## Capability enforcement

- Backend commands and scheduled jobs must evaluate the effective engagement.
- Disabled capabilities must not be activated indirectly by frontend access, background processing, or integration events.
- Optional capabilities require explicit engagement configuration.
- Model changes are prospective/effective-dated and must preserve historical context.
- Handoff or closure must stop future recurring jobs without deleting prior activity.

## Related ADR

- [ADR-004](adr/ADR-004-service-model-driven-capabilities.md)

## Remaining policy dependencies

The business must still approve engagement inheritance for parent/child spaces, transitions and offboarding, fee schedules, brokerage completion/commission details, tenant-placement guarantees/custody, rent-collection notices/deposits, and maintenance-only commercial rules if activated.
