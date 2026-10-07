REAL ESTATE OPERATIONS PLATFORM
COMPLETE SYSTEM DOCUMENTATION
Expanded Business-Model-Aware Blueprint

Document type Integrated BRD, PRD, SRS and Technical Blueprint
Operating model Single company, multi-branch, multi-portfolio, multi-business-model
Version / Date Version 3.0 — 22 August 2026
Status Canonical planning and implementation baseline
Scope Rental • Brokerage • Sales • Property Management • Development/Construction roadmap

Business • Product • Software • Data • Finance • Operations • Security • Delivery
CONFIDENTIAL PROJECT BLUEPRINT
 
Document Control
Field Value
Document owner Real Estate Operations Platform Project Team
Primary audience Company founders, executives, managers, product, UX, engineering, QA, finance, brokerage, development and operations teams
Purpose Define the canonical business, product, software, data, finance, UX, security and delivery baseline before and during implementation
Architecture baseline Single-company, multi-branch, business-model-aware modular monolith with internal operations and future external portals
Financial baseline Manual-first financial recording with auditable double-entry accounting planned in Phase 6
Status V3.0 scope expansion: rental + sales brokerage + company-owned development + client construction roadmap

Revision History
Version Date Change
1.0 04 Aug 2026 Initial complete rental-property-management documentation baseline.
2.0 07 Aug 2026 Business-model-aware redesign: brokerage-only rental lifecycle, full management, master lease/sublease, RentableSpace hierarchy, commercial partitioning and land specialization.
3.0 22 Aug 2026 Expanded platform scope: rental brokerage renamed for clarity, sale brokerage foundation, buyer/seller/construction CRM intents, SaleListing → Property, company-owned development model, client construction roadmap, revised phase plan, and blue-first UX direction.

Legal and accounting note
This blueprint defines a configurable software platform. Sale transfer rules, property registration, construction contracts, tax, deposit handling, licensing, escrow/client-money handling, privacy, consumer protection and accounting treatment must be reviewed against the laws and practices of the country where the company operates.

Table of Contents

1. Executive Summary
2. Vision, Objectives and Success Measures
3. Business Context and Operating Models
4. Scope, Assumptions and Constraints
5. Stakeholders, Actors and Governance
6. Business Requirements (BRD)
7. Product Requirements (PRD)
8. Functional Requirements by Module
9. End-to-End Business Workflows
10. Business Rules and State Models
11. Roles, Permissions and Approval Matrix
12. Information Architecture and UX Design System
13. Data Model and Database Blueprint
14. API and Integration Specification
15. Accounting and Financial Control Design
16. Non-Functional, Security and Privacy Requirements
17. Reporting, Analytics and KPIs
18. Testing, Acceptance and Quality Assurance
19. Deployment, Operations and Disaster Recovery
20. Implementation Roadmap and Phase Gates
21. Risks, Decisions and Future Scope
22. Glossary and Traceability
     
23. Executive Summary
    The platform is the operational system of record for a professional real-estate company that manages rental portfolios, brokers rental and property-sale transactions, operates company-owned assets, coordinates leasing and property operations, and is architected to expand into client construction and company-owned real-estate development without replacing the core property model.
    Core definition
    This is not merely a property listing website, a personal landlord application, or a construction tracker. It is an integrated real-estate operations platform where Property represents legal/physical assets, RentableSpace represents rental/occupancy targets, and commercial workflows are activated by explicit business models and capabilities.

1.1 Business Outcomes
• One trusted record for every party, owner, property, building, RentableSpace, lead, listing, contract and transaction.
• Clear separation between rental operations, sale brokerage, company-owned sales and future development/construction workflows.
• Faster lead-to-deal conversion using controlled CRM, matching, viewing, application and follow-up workflows.
• Auditable owner funds, tenant funds, company revenue, commissions and future development costs.
• Traceable property lifecycle, documents, branch responsibility, ownership, service engagement and activity history.
• Scalable multi-branch operations without duplicating core entities or embedding business models into physical property types.
1.2 Solution Surfaces
Surface Primary users Purpose
Internal operations portal Executives, branch managers, agents, property managers, accountants, brokerage staff, development staff Company workflows, approvals, records and reporting
Owner portal (future) Property owners / representatives Portfolio, financial, lease, maintenance, document and payout transparency
Tenant portal (future) Applicants / tenants Applications, leases, balances, receipts, notices and requests
Public marketing website (future) Prospective renters and buyers Rental/sale listings, inquiries and lead capture
Vendor portal (future) Technicians / service companies Assigned work, quotations, evidence and invoices

2. Vision, Objectives and Success Measures
   2.1 Vision Statement
   To provide a reliable, secure and locally adaptable platform that enables a real-estate company to operate rental, brokerage, sales and future development activities professionally at scale while protecting client and owner interests, maintaining financial integrity and giving management timely operational control.
   2.2 Strategic Objectives
   Objective Definition
   Operational control Standardize business workflows across branches and reduce spreadsheets, informal phone-based records and hidden side processes.
   Commercial flexibility Support rental management, rental brokerage, sale brokerage, company-owned properties and future development without conflating the underlying physical asset model.
   Financial integrity Make every fee, commission, charge, payment, expense, owner balance and future development cost explainable and reconcilable.
   Growth Support portfolio, branch, CRM, sales and development growth without redesigning core concepts.
   Customer trust Provide clear records, documents, status, history and controlled handoffs for owners, tenants, buyers, sellers and construction clients.
   Risk reduction Enforce least privilege, branch scope, approvals, evidence, effective dating, auditability and immutable financial history.

2.3 Success Metrics
Area Metric Initial target / policy
Leasing Median days from qualified rental lead to signed lease ≤ 14 days for ready residential spaces; configurable
Sales brokerage Qualified buyer lead to accepted sale outcome Track funnel conversion; target configurable
Occupancy Occupied RentableSpaces / active rentable inventory ≥ 90% target; configurable
Collections Cash collected / charges due ≥ 95% by month close
Owner reporting Statements issued on schedule 100%
Data quality Active leases without signed documents / required prerequisites 0
Security Privileged actions without audit event 0
Development (future) Completed / planned units and cost variance Tracked by project once Phase 10 is implemented

3. Business Context and Operating Models
   3.1 Supported Property Portfolios
   • Single-family homes, villas and compounds
   • Apartments and multi-unit residential buildings
   • Rooms and shared housing
   • Offices, shops, halls, booths, warehouses and commercial buildings
   • Mixed-use buildings
   • Vacant land, yards, parking and storage sites
   • Company-owned development sites and independently saleable resulting properties (planned expansion)
   3.2 Foundational Domain Principle: Physical Asset ≠ Business Model
   Critical architecture decision
   Property / RentableSpace type describes WHAT the asset physically is. ServiceEngagement and transaction purpose describe HOW the company earns from or operates it. A LAND Property may be rented, sale-brokered, company-owned and developed at different times without changing the meaning of LAND.

Physical / legal concept Examples Commercial model examples
Property Villa, house, land parcel, commercial building, independently transferable apartment title Sale brokerage, company-owned, full management, future development
Building Physical structure inside a Property May contain rental inventory; not itself a service model
RentableSpace Apartment, room, floor, office, shop, hall, booth Rental brokerage, full management, tenant placement, master lease/sublease

3.3 Supported Commercial Arrangements
Model How it works Typical income
RENTAL_BROKERAGE Company markets/sources a rental opportunity, closes the rental deal, then hands off without recurring management unless separately engaged. One-time rental brokerage commission
SALE_BROKERAGE Company markets and brokers the sale of an owner-owned Property such as a villa, building or land parcel. Sale commission / brokerage fee
TENANT_PLACEMENT Company finds and places a tenant and returns ongoing management to owner. Placement fee
FULL_MANAGEMENT Company manages leasing, collections, maintenance, reporting and owner payout cycle. Management fee + approved service fees
RENT_COLLECTION_ONLY Company manages charges/collection without full operations. Collection fee
MASTER_LEASE_SUBLEASE Company rents parent asset and sublets child RentableSpaces. Spread / operating margin
COMPANY_OWNED Company owns the Property and keeps rental or sale economics directly. Rent, sale proceeds, development profit
CONSTRUCTION_FOR_CLIENT (future execution) Client engages company to construct a house/project, potentially using configurable down payment + installments. Construction contract revenue
COMPANY_DEVELOPMENT (future execution) Company develops its own land into blocks/plots/houses and sells resulting independent Properties. Development sales revenue / margin

3.4 Sale Brokerage Operating Model
• Sale Listing targets a Property, not a RentableSpace.
• Land sale uses Property type LAND plus SALE_BROKERAGE; no duplicate LAND_SALE_BROKERAGE model.
• External-owner sale commission belongs to brokerage terms; company-owned sale proceeds are company revenue and are not a commission paid to itself.
• Full sale deal, settlement and ownership transfer are intentionally deferred to the specialized commercial/sales phase.
3.5 Company-Owned Development Model
A company may own a large development site, organize it into planning Blocks and Plots, construct houses/villas/other assets, and later sell each independently transferable result. The development hierarchy is operational/planning metadata; any asset that can transfer legal ownership independently must become or link to a canonical Property before sale completion.
Concept Meaning
DevelopmentSite The company-owned parent LAND Property used for the project.
DevelopmentProject The commercial/operational project executed on the site.
DevelopmentBlock Planning/grouping area such as Block A, Block B.
DevelopmentPlot Planned lot/plot; may later link to an independently registered Property.
Saleable Property The legal asset sold to a buyer; source of truth for ownership and sale listing.
Development Inventory Read model of planned, under construction, completed, sale-ready, reserved and sold inventory.

3.6 Client Construction Model
A separate future workflow supports clients who hire the company to build a house/project. The client-construction agreement may require an initial payment such as 40%, but the percentage must be configurable rather than hard-coded; the remaining balance may be scheduled in installments and integrated with the platform finance engine.
Important distinction
Developer-owned construction and client construction share construction concepts (milestones, progress, documents, contractors) but have different ownership, revenue and accounting semantics. They must not be collapsed into one ambiguous workflow.

4. Scope, Assumptions and Constraints
   4.1 In Scope for Core Platform Roadmap
   • Company, branches, employees, roles, permissions, access scopes and audit.
   • Parties, owners, ownership, properties, buildings, RentableSpaces, hierarchy, measurements, amenities and documents.
   • Effective-dated ServiceEngagements and centralized capability resolution.
   • CRM leads with RENT, BUY, SELL and CONSTRUCTION_SERVICE intents; sources, activities, follow-ups and assignments.
   • Rental listings to RentableSpace; sale listings to Property.
   • Rental viewings, applications, screening, reservations, tenant conversion, lease contracts, renewals and move-in.
   • Billing, payments, accounting, deposits, management fees, owner statements and payouts.
   • Property sales/brokerage execution in a later specialized commercial phase.
   • Maintenance, inspections, vendors, work orders, move-out and turnover.
   • Portals, reporting, notifications, security hardening and production readiness.
   • Real-estate development and client construction in Phase 10.
   4.2 Explicitly Deferred / Future Scope
   • Full hotel/nightly booking engine
   • Full payroll/HR suite
   • Advanced investment-fund accounting
   • IoT building automation and smart locks
   • AI-only approval or rejection of tenants/buyers
   • Cryptocurrency/blockchain contracts
   • Jurisdiction-specific conveyancing automation beyond approved sales scope
   4.3 Key Assumptions
   • Initial product serves one real-estate company with multiple branches, not unrelated SaaS customer companies.
   • Company may own properties, manage owner-owned properties, broker rentals, broker sales and later execute development projects.
   • USD remains default currency unless configured otherwise.
   • Payments may initially be recorded manually from cash, bank transfer, EVC Plus, eDahab or other channels.
   • Local legal, tax, sale transfer, deposit and construction rules require professional review.
   4.4 Constraints
   • Posted financial records cannot be casually edited or deleted.
   • A non-shared RentableSpace cannot have conflicting active occupancy/reservations.
   • Signed documents and effective-dated history require version/history preservation.
   • Company-wide access is never implied solely by a powerful role.
   • First-class workspaces must use complete server-side search/filter/pagination; current-page-only search and limit=100 completeness workarounds are prohibited.
5. Stakeholders, Actors and Governance
   Stakeholder Primary interest System responsibility
   Company owners/directors Growth, risk, profit, governance Approve strategy and major controls
   General manager Operational performance Own company workflows and policy
   Branch manager Branch delivery/accountability Approve branch operations within limits
   Property manager Portfolio condition and owner/tenant service Manage assigned portfolio and leases
   Leasing agent Rental lead conversion Manage pipeline, viewings and leasing
   Sales/brokerage agent Buyer/seller conversion and commission Manage sale leads, listings, negotiation handoffs
   Development manager (future) Project delivery, inventory, cost and sales readiness Manage development projects/blocks/plots
   Accountant / finance manager Accuracy, control, reporting Post, reconcile, close and report
   Owner / seller Asset performance / sale outcome Approve where required and receive records
   Tenant / applicant Fair rental service Provide information, sign, pay and comply
   Buyer Transparent sale process Provide offer/verification and complete sale requirements
   Construction client (future) Project delivery and payment clarity Approve scope, pay according to plan, accept handover

5.2 Governance Principle
NO PASS = NO NEXT PHASE
Every implementation phase has a defined scope and quality gate. A later phase must not begin until the current phase passes unit/integration/E2E testing, security/authorization review, migration validation, UI/UX review where applicable, documentation update and closure of all CRITICAL/HIGH defects.

6. Business Requirements (BRD)
   ID Domain Business requirement
   BR-001 Organization Manage company, branches, employees, assignments and operating scopes.
   BR-002 Access Restrict records/actions by permission, branch scope and resource scope.
   BR-003 Parties/Owners Maintain canonical Party identity, OwnerProfile, ownership shares, preferences and payout instructions.
   BR-004 Portfolio Model Property, Building and RentableSpace hierarchies with effective-dated ownership/branch assignment.
   BR-005 Availability Know physical, marketing and occupancy status of every RentableSpace.
   BR-006 Service Models Resolve allowed capabilities through effective-dated ServiceEngagements rather than scattered service-model checks.
   BR-007 CRM Capture RENT/BUY/SELL/CONSTRUCTION_SERVICE leads, source, assignment, activity, follow-up and preferences.
   BR-008 Marketing Publish rental listings for RentableSpaces and sale listings for Properties.
   BR-009 Rental Leasing Control viewing, application, screening, reservation, tenant conversion, lease, renewal and move-in.
   BR-010 Sales Brokerage Support seller/buyer pipeline, sale listing and later sale-deal/commission execution for Property including LAND.
   BR-011 Finance Generate charges, receive/allocate payments, maintain double-entry records, reversals and period control.
   BR-012 Owner Funds Calculate managed-owner balances, fees, reserves, statements and payouts.
   BR-013 Operations Manage maintenance, inspections, vendors, work orders, move-out and turnover.
   BR-014 Documents Securely store and version owner/property/tenant/lease/sale/development documents.
   BR-015 Development Support future company-owned development sites, blocks, plots, construction progress and sales inventory.
   BR-016 Client Construction Support future client construction agreements, configurable down payment, installments and handover.
   BR-017 Reporting Provide role-relevant dashboards, filters, exports and KPI drill-down.
   BR-018 Audit Record sensitive business actions in append-oriented/tamper-resistant audit history.
   BR-019 Localization Support Somali/English, local addresses, configurable units/payment channels.
   BR-020 Continuity Support backup, recovery, monitoring and controlled deployment.

7. Product Requirements (PRD)
   7.1 Product Principles
   • One source of truth for each real-world entity.
   • Workflow before freedom for high-risk states.
   • Physical asset, rental target and commercial model are separate concepts.
   • Financial entries are posted/reversed/reconciled, not silently edited.
   • Task-based navigation: page names describe the work, not generic “Overview”.
   • Global workspace and record-detail context are visually and functionally distinct.
   • Server-side complete-data search/filter/pagination for operational registers.
   • Mobile-friendly field workflows; desktop-efficient finance and administration.
   • Configuration over hard-coded local rules.
   7.2 Primary User Journeys
8. Onboard Party/Owner → Property → Building/RentableSpace → activate portfolio.
9. Create ServiceEngagement → publish eligible RentalListing → convert RENT lead through viewing/application/reservation/lease.
10. Create SALE_BROKERAGE engagement → publish SaleListing → match BUY lead to Property; later hand to sale-deal workflow.
11. Operate Full Management → recurring finance → owner statement/payout.
12. Manage maintenance issue → responsibility → work order → expense allocation.
13. Company-owned Property → rental or sale capability without a fake self-brokerage agreement.
14. Future: Company-owned development site → blocks/plots → construction → saleable Properties → sale inventory.
15. Future: Construction client → agreement → configurable initial payment → installments → milestones → handover.
16. Functional Requirements by Module
    Module Required capability
    Organization & Access Company profile, branches, employees, user accounts, roles, permissions, branch scopes, session/security controls.
    Portfolio Parties, Owners, Property Register, Buildings, RentableSpaces, hierarchy, measurements, profiles, amenities, documents, ownership and branch assignments.
    Commercial / Service Engagements Effective-dated commercial model, scope inheritance/override, compatibility matrix and capability resolver.
    CRM Lead Register, intents, sources, preferences, activities, follow-ups, assignment history, pipeline.
    Marketing RentalListing → RentableSpace; SaleListing → Property; review/publish lifecycle; deterministic matching.
    Leasing Viewings, applications, screening, reservations, tenant conversion, leases, renewals and move-in.
    Sales & Brokerage Later: offers/negotiation, sale deal, commission terms, settlement, ownership transfer.
    Finance Charges, invoices, payment allocation, tenant credits, deposits, journals, reversals, periods, owner funds.
    Operations Maintenance, inspections, vendors, quotations, work orders, move-out and turnover.
    Development & Construction Phase 10: development projects/sites/blocks/plots, construction milestones, inventory, client construction payment plans and handover.
    Reporting & Portals Management dashboards, role-specific reports, owner/tenant portals, notifications and document access.

17. End-to-End Business Workflows
    9.1 Rental Management
    Owner/Company Property → ServiceEngagement → RentalListing → RENT Lead → Match → Viewing → Application → Reservation → Tenant → Lease → Move-In → Billing/Operations → Renewal/Move-Out.
    9.2 Rental Brokerage
    Owner Property/RentableSpace → RENTAL_BROKERAGE → RentalListing → Lead → Viewing/Deal → Commission → RENTED_EXTERNAL / handoff; no recurring management unless service model changes.
    9.3 Sale Brokerage
    Owner Property → SALE_BROKERAGE → SaleListing → BUY Lead → Match/Viewing → later Offer/SaleDeal → Commission → Ownership Transfer.
    9.4 Company-Owned Sale
    Company ownership → SaleListing → BUY Lead → later SaleDeal → sale proceeds; no self-brokerage commission.
    9.5 Company Development
    Company-owned LAND Property → DevelopmentProject → Blocks/Plots → construction → independently saleable Property → SaleListing → SaleDeal.
    9.6 Client Construction
    CONSTRUCTION_SERVICE lead → future agreement → configurable initial payment → milestones/installments → completion/handover.
18. Business Rules and State Models
    Domain Canonical states / rule
    ServiceEngagement DRAFT → ACTIVE → INACTIVE/EXPIRED/CANCELLED; effective dates classify Current/Scheduled/Historical.
    Lead NEW → CONTACTED → QUALIFIED → MATCHING/NURTURING → CONVERTED or LOST.
    Listing DRAFT → PENDING_REVIEW → PUBLISHED ↔ PAUSED → UNPUBLISHED/CLOSED → ARCHIVED.
    Viewing SCHEDULED → CONFIRMED → COMPLETED / CANCELLED / NO_SHOW.
    Application DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED/REJECTED/WITHDRAWN.
    Reservation ACTIVE → EXPIRED/CANCELLED/CONVERTED; conflicting active holds prohibited.
    Lease DRAFT → PENDING_APPROVAL → APPROVED → PENDING_SIGNATURE → SIGNED → ACTIVE → ENDED/TERMINATED → ARCHIVED.
    Property ownership Effective-dated; independently transferable assets use Property as source of truth.
    DevelopmentPlot (future) PLANNED → AVAILABLE → UNDER_CONSTRUCTION → COMPLETED/SALE_READY; legal saleability must link/create Property.

19. Roles, Permissions and Approval Matrix
    Authorization is evaluated as permission + branch scope + resource scope. Role names do not automatically grant company-wide visibility. Granular permissions are grouped by business domain and backend enforcement is authoritative.
    Domain Example permissions
    Portfolio party.read, owner.read, portfolio.property._, portfolio.building._, portfolio.space._, portfolio.document._
    Commercial service-engagement.read/create/update/activate/cancel, capability.read
    CRM crm.lead._, crm.followup._, crm.source._, crm.assignment._
    Marketing listing.read/create/update/submit/review/publish/pause/close/archive
    Leasing viewing._, application._, screening._, reservation._, tenant._, lease._, move-in.*
    Finance invoice._, payment._, journal._, reconciliation._, owner-payout.*
    Sales (later) sale-deal._, offer._, commission._, settlement._
    Development (future) development-project._, development-plot._, construction._, handover._

20. Information Architecture and UX Design System
    UX north star
    A new employee should understand where they are, what the page is for, whether it is a global workspace or a single-record context, and what action to take next—without needing to understand database terminology.

12.1 Navigation Model
Navigation group Task-based pages
Dashboard Dashboard
Organization Company Profile; Branches
Team & Access Employees; User Accounts; Roles & Permissions
Portfolio Party Register; People; Organizations; Owner Register; Owned Properties; Property Register; Buildings; Property Ownership; Property Amenities; Property Documents; Branch Assignments; Property Activity; Space Register; Space Hierarchy; Measurements; Space Profiles; Space Amenities; Space Documents; Space Lifecycle; Amenities Catalog
Commercial Engagement Register
CRM Lead Register; Pipeline; Follow-ups; Lead Sources; Viewings
Marketing Listing Register; Review Queue
Leasing Applications; Reservations; Tenants; Leases; Renewals; Move-In
Finance / Operations / Reporting Introduced in later phases according to phase roadmap

12.2 Global Workspace vs Record Detail
Sidebar destinations are complete authorized workspaces across the business. Record detail pages manage one selected entity and may use contextual tabs. Drawers/modals are for quick preview or short actions, not full application pages.
12.3 Search and Filter Standard
• First-class registers use server-side search, structured filters, stable cursor pagination and complete authorized datasets.
• Entity filters use accessible async searchable comboboxes; users are not expected to type UUIDs or technical codes.
• Changing search/filter/sort resets cursor safely; URL query state is preferred where practical.
• Mobile uses search + filter trigger/sheet rather than stacking many controls above data.
• No current-page-only “global search”, no limit=100 completeness workarounds, no per-row N+1 detail fetching.
12.4 Visual System — Blue Primary
Token Value Use
Primary Blue #2563EB Primary actions, active navigation, selected controls
Primary Hover #1D4ED8 Hover/pressed primary
Strong Blue #1E40AF Strong accents
Soft Blue #EFF6FF Selected/soft information backgrounds
Sidebar #020617 Navigation background
App Background #F8FAFC Canvas
Surface #FFFFFF Cards/tables/forms
Border #E2E8F0 Dividers/borders
Primary Text #0F172A Main text
Secondary Text #475569 Supporting text
Success #059669 Success/active health states
Warning #D97706 Warning/pending
Danger #DC2626 Destructive/error

12.5 Record Actionability
• Property → create/open Building → create RentableSpace must be obvious.
• Building with zero spaces shows an actionable Add Rentable Space empty state.
• Documents expose upload, view/read, download where supported, version history, metadata and archive—not only metadata editing.
• Business-specific table headers replace generic RECORD / CONTEXT / DETAILS where clearer domain labels exist.
• Raw enum strings, UUIDs and storage keys are hidden from normal users. 13. Data Model and Database Blueprint
13.1 Canonical Core Entities
Entity Purpose / key relationship
Party Canonical person/organization identity.
OwnerProfile Owner business role attached to Party.
Property Legal/physical asset; canonical sale/ownership target.
PropertyOwnership Effective-dated ownership interests.
Building Optional physical structure under Property.
RentableSpace Canonical rental/occupancy target; recursive hierarchy allowed.
ServiceEngagement Effective-dated commercial relationship/capability source.
Lead / LeadIntent CRM prospect/opportunity with RENT/BUY/SELL/CONSTRUCTION_SERVICE intent.
RentalListing Marketing record targeting RentableSpace.
SaleListing Marketing record targeting Property.
Viewing/Application/Reservation/Lease Rental conversion lifecycle.
Document/DocumentVersion Secure metadata + file/version history.
AuditEvent Append-oriented business/security history.

13.2 Development Extension (Phase 10)
Entity Purpose
DevelopmentProject Development initiative tied to company-owned development site.
DevelopmentBlock Planning/grouping subdivision.
DevelopmentPlot Planned lot; may link to legal Property when independently transferable.
ConstructionMilestone Progress stage/evidence.
DevelopmentInventory read model Operational status across plots/houses/properties.
ConstructionAgreement Client-construction commercial agreement.
ConstructionPaymentPlan Configurable down payment and installment schedule integrated with finance engine.

Critical ownership rule
Any asset that can transfer independent legal ownership must be represented as, or linked to, a canonical Property before sale completion. RentableSpace remains the rental/occupancy target and must not be reused merely because an asset is independently saleable.

13.3 Database Integrity
• Foreign keys and unique constraints for canonical references/business codes.
• Native/equivalent protection for effective-date overlap where practical.
• Concurrency-safe business record numbering.
• Stable cursor pagination ordering uses deterministic tie-breakers.
• Historical referenced records are retired/versioned, not hard-deleted.
• Migrations are append-only; already shared migration history is never rewritten. 14. API and Integration Specification
REST APIs follow modular business boundaries. First-class workspaces use focused list/read-model endpoints rather than client-side joins or N+1 detail requests. Authorization is enforced in the API/service layer and database queries are scoped before results are returned.
API area Examples
Portfolio /parties, /owners, /properties, /buildings, /rentable-spaces, /property-ownerships, /portfolio-documents
Commercial /service-engagements, capability resolution
CRM /leads, /lead-sources, /follow-ups, /lead-activities
Listings /rental-listings, /sale-listings, review/publish lifecycle
Leasing /viewings, /applications, /reservations, /leases, /renewals, /move-ins
Finance / Sales / Development Added only in their approved phases

14.1 API Quality Rules
• Cursor pagination for potentially large lists.
• Server-side search/filter/sort over complete authorized dataset.
• Human-safe error mapping for constraint/authorization failures.
• No raw SQL/Prisma errors exposed to users.
• File access uses authorized secure routes/URLs for confidential documents.
• Idempotency/concurrency strategy for high-risk commands. 15. Accounting and Financial Control Design
Finance remains a dedicated accounting authority. Posted journals are immutable; corrections use reversal/adjustment. Owner funds, company funds, security deposits and tenant credits are economically distinct and must not be mixed.
Economic flow Treatment
Managed rent received May create owner-funds liability subject to approved fees/expenses.
Rental brokerage commission Company revenue when earned according to deal terms.
Sale brokerage commission Company revenue when earned; seller/buyer payer rules configurable in sales phase.
Company-owned rent Company revenue.
Company-owned Property sale Sale proceeds/company asset disposal economics; not self-commission.
Client construction down payment Future construction contract receipt; configured percentage/amount, not hard-coded 40%.
Developer construction costs Future development inventory/project cost accounting integrated with Phase 6 finance.

15.1 Manual Payment Baseline
The initial operating model supports manual recording/verification of cash, bank transfer, EVC Plus, eDahab and similar channels. Payment gateways are optional integrations, not a prerequisite for core financial control. 16. Non-Functional, Security and Privacy Requirements
• Least-privilege backend authorization with BRANCH / MULTI_BRANCH / COMPANY_WIDE scope.
• Hashed opaque sessions / secure cookie policy according to current identity architecture.
• Sensitive document access checked server-side; confidential files must not be world-readable.
• Audit privileged/security-sensitive actions.
• Rate limiting / brute-force controls on authentication and sensitive endpoints.
• Input validation using shared DTO/schema patterns; server is source of truth.
• Performance: avoid N+1, unbounded list loading and expensive totals without justification.
• Accessibility: keyboard navigation, visible focus, semantic labels, reduced motion, text + color status.
• Responsive acceptance at 1440 / 768 / 390 px for frontend-containing phases. 17. Reporting, Analytics and KPIs
Area Examples
Portfolio Properties by branch/type/status, RentableSpace availability, ownership/branch changes
CRM Lead source conversion, follow-ups due, agent pipeline, RENT/BUY/SELL intent funnel
Rental marketing Published listings, days on market, viewing/application conversion
Sales marketing Sale listings, buyer matches, later sale conversion/commission
Finance Collections, arrears, journals, owner payable, deposits, reconciliation
Operations Maintenance SLA, vendor performance, turnover
Development (future) Plots/units by stage, construction progress, cost variance, sale-ready inventory, gross margin

18. Testing, Acceptance and Quality Assurance
    18.1 Definition of Done
    • Approved scope fully implemented.
    • Unit, integration and relevant E2E tests pass.
    • Security/authorization matrix passes.
    • Database constraints/concurrency/effective-dating tests pass where applicable.
    • Lint, strict typecheck and production build pass.
    • Fresh and upgrade migrations pass; seed is idempotent.
    • No unresolved CRITICAL or HIGH defect.
    • Documentation and completion report updated.
    • Manual UI/UX review completed for frontend phases.
    18.2 Mandatory Regression Themes
    Theme Required evidence
    Pagination/search Records beyond page 1 discoverable through server-side search/filter.
    Authorization BRANCH/MULTI_BRANCH/COMPANY_WIDE and company isolation.
    N+1 No one-detail-request-per-row pattern in aggregate workspaces.
    Concurrency Conflicting engagement/listing/reservation/lease states protected.
    Documents Upload/view/download/version authorization where implemented.
    UI states Loading, empty, filtered-empty, error and populated states.
    Responsive 390, 768 and 1440 px manual/automated review.

19. Deployment, Operations and Disaster Recovery
    • Dockerized/local managed dependencies with PostgreSQL and Redis.
    • Production behind reverse proxy / TLS on managed container platform or Ubuntu VPS according to deployment plan.
    • Health checks, structured logs, alerting and backup monitoring.
    • Database backup/restore tests before production-readiness gate.
    • Rollback plan for application releases; database migrations designed for safe forward progress.
    • Clean-checkout validation ensures repository can build/test from a fresh environment.
20. Implementation Roadmap and Phase Gates
    Phase Workstream Status Main scope Ends with
    0 Business Analysis & Architecture Completed Business rules, service models, workflows, permissions, accounting principles, architecture boundaries Approved architecture package
    1 Database & Data Architecture Completed Relational model, RentableSpace hierarchy, finance design, Prisma/PostgreSQL constraints/indexing Reviewed database package
    2 Technical Foundation Completed Monorepo, Next.js, NestJS, PostgreSQL, Prisma 6, Redis, BullMQ, Docker, CI/testing Stable development platform
    3 Identity, Organization & Access Completed Authentication, branches, employees, roles, permissions, scopes, audit/security Secure organization/access layer
    4 Owners, Properties & Rentable Spaces Completed / closure verified Parties/owners, property/building/RentableSpace, ownership, documents, hierarchy, search/filter workspaces Complete portfolio foundation
    5 Commercial Foundation, CRM & Leasing Next ServiceEngagements, CRM, rental/sale listing foundation, matching, viewings, applications, reservations, tenants, leases, renewals, move-in End-to-end rental leasing + sales-marketing foundation
    6 Billing, Payments & Accounting Planned Charges, invoices, payment allocation, tenant credits, double-entry, reversals, periods, financial controls Trusted financial transaction engine
    7 Full Management, Sales/Brokerage & Specialized Commercial Models Planned Deposits, management fees, owner payout, rental brokerage, property/land sale deals, commissions, master lease/sublease, shared utilities Core commercial operations complete
    8 Maintenance, Inspections & Operations Planned Maintenance, vendors, work orders, quotations, inspections, move-out, turnover Property operations complete
    9 Portals, Reporting & Production Readiness Planned Dashboards, portals, notifications, document access, security hardening, backups/restore/deployment Production-ready MVP release candidate
    10 Real Estate Development & Construction Planned expansion Development sites/blocks/plots, developer-owned construction/inventory, client construction, milestones, payment plans, handover Development & construction capability

20.1 Phase 5 Sub-Phases
Sub-phase Scope Gate
5.1 Service Engagements & capability resolver STOP after PASS
5.2 CRM foundation — intents, sources, preferences, activity, follow-ups, assignment STOP after PASS
5.3 Rental/Sale Listings & deterministic Matching STOP after PASS
5.4 Viewings STOP after PASS
5.5 Applications & Screening STOP after PASS
5.6 Reservations STOP after PASS
5.7 Tenant Conversion & Lease Contracts STOP after PASS
5.8 Renewals & Move-In STOP after PASS
5.9 Full Phase 5 regression/closure Phase 6 allowed only after PASS

21. Risks, Decisions and Future Scope
    Decision / risk Current direction
    Property sale vs rental target Property is sale/ownership target; RentableSpace is rental/occupancy target.
    Land sales Use Property type LAND + SALE_BROKERAGE; no duplicated land-sale domain.
    Company-owned sales Ownership is source of truth; do not create fake self-brokerage agreement/commission.
    Construction 40% initial payment Requirement supported as configurable payment term; never hard-code 40%.
    Development blocks/plots Planning entities; independent transferable assets must become/link to Property.
    Apartment title sales If independently transferable, model as legal Property; it may also have its own RentableSpace for rental.
    UI complexity Task-based pages, dedicated workspaces, quick preview drawers only, blue-first consistent design.
    Scope creep No phase implements later financial/sales/development workflows without passing prior phase gate.

22. Glossary and Traceability
    Term Definition
    Party Canonical person/organization identity.
    Owner Party with ownership/owner business role.
    Property Legal/physical real-estate asset; canonical ownership and property-sale target.
    Building Physical structure within a Property.
    RentableSpace Canonical independently rentable/leasable/occupiable target.
    ServiceEngagement Effective-dated commercial relationship determining capabilities.
    RentalListing Marketing record for a RentableSpace.
    SaleListing Marketing record for a Property.
    Lead CRM prospect/business opportunity.
    Lead Intent RENT, BUY, SELL or CONSTRUCTION_SERVICE.
    Applicant Lead/person who submitted rental application.
    Tenant Party with rental/lease role.
    Lease Rental contract and operational record targeting RentableSpace.
    Sale Deal Later-phase property-sale transaction.
    DevelopmentProject Future company-owned development initiative.
    DevelopmentBlock Planning/grouping segment of development site.
    DevelopmentPlot Planned lot/plot that may later link to an independently saleable Property.
    Construction Client Future client who engages the company to construct a project.
    Posting Finalization into financial ledgers.
    Reversal Controlled opposite transaction correcting a posted transaction.

22.1 Traceability Principle
Every implementation phase must trace completed features back to this V3.0 scope, its phase document, database migrations, API/UI evidence and tests. If an implementation decision materially changes a canonical rule in this document, the document and relevant ADR must be updated before the next phase gate.
