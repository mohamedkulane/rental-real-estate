# Business workspaces

## Portfolio

Portfolio is the canonical asset master-data area. Its top-level Advanced Records remain Parties, Owners, Properties, Rentable Spaces, and Amenities. Building detail plus Ownership, Documents, and Branch Assignments remain advanced contextual capabilities inside the relevant asset/owner experience. Guided onboarding becomes the preferred normal entry, not a replacement for any of them.

## CRM

CRM is the shared customer layer built on one Lead aggregate. “All Leads” remains available by permission. Contextual views show Rental Leads, Buyer/Seller Leads, or Construction Service Enquiries by server-side intent filters. They do not create business-specific Lead models.

## Rental Brokerage

At the present passed phase boundary this workspace may expose setup/service-authority context only. Future Listing, matching, Viewing, Application, Reservation, placement, closed-deal, and commission modules activate only after their own phases pass.

## Full Management

At the present boundary this workspace may expose active/effective `FULL_MANAGEMENT` Engagement context (or a later approved granular capability conjunction/read model). It does not invent a single resolver boolean named “Full Management capability.” Tenants, Leases, rent collection, maintenance, Expenses, statements, and payouts remain absent until their phases pass.

## Property Sales

At the present boundary this may expose sale-authority setup and CRM SELL context only. Sale listings, offers, negotiation, SaleDeal, settlement, transfer, commission, and accounting remain absent.

## Service Authorities

The canonical Service Engagement register/detail remain as an advanced Commercial workspace. User-facing guided workflows call this domain but do not bypass its resolver or lifecycle.

## Future/disabled boundary

Do not ship dead navigation for Listings, matching engines, Viewings, Applications, Reservations, Tenants, Leases, Finance, Maintenance, ConstructionProject, DevelopmentProject, construction agreements/milestones/payment plans, or development inventory/accounting. A noninteractive roadmap may mention future availability only if separately approved; it is not part of operational navigation.

### Authoritative Phase 5.2 exclusion contract

Phase 5.2 creates, mutates, or emulates none of: Rental Listing, Sale Listing, Generic Listing; matching candidates, algorithms, scores, or results; Viewing; Application; Screening; Reservation; Tenant; Lease, renewal, or move-in; Finance records; offer; SaleDeal; settlement; ownership transfer; commission; ConstructionProject; ConstructionAgreement/contract; construction milestone or handover; construction payment plan, down payment, or installment; DevelopmentProject; development block, plot, inventory, or development accounting. `MATCHING` is a Lead stage only. `CONSTRUCTION_SERVICE` conversion creates no Phase 10 aggregate.

## Required list behavior

Every first-class workspace uses focused server APIs with server-side case-insensitive search, relevant filters, stable cursor pagination, backend branch/company scope, accurate global totals or explicitly labeled page counts, and loading/empty/error/populated states. Query budgets must prevent N+1. A related record beyond a parent page boundary must remain discoverable independently.

## Detail experience

Quick preview stays concise. Complex changes use dedicated routes or focused dialogs. Property, Owner, Building, Space, Engagement, and Lead details retain contextual tabs/actions. Guided workflows link to completed canonical records without turning them into wizard-owned objects.
