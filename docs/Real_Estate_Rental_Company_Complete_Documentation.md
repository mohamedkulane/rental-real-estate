REAL ESTATE RENTAL COMPANY
COMPLETE SYSTEM DOCUMENTATION
Business • Product • Software • Data • Finance • Operations • Security • Delivery
Document type Integrated BRD, PRD, SRS and Technical Blueprint
Target organization Professional real-estate rental and property-management company
Operating model Single company, multi-branch, multi-portfolio
Prepared for Mohamed Ahmed Mahmoud
Version / Date Version 2.0 — 7 August 2026
CONFIDENTIAL PROJECT BLUEPRINT
VERSION 2.0 — BUSINESS-MODEL-AWARE BLUEPRINT
 
Document Control
Field Value
Document owner Real Estate Rental Company Project Team
Primary audience Company founders, managers, product team, designers, developers, QA, finance and operations
Purpose Define the complete hypothetical but operationally realistic system before implementation
Scope baseline Residential, commercial and land rental operations; brokerage-only deals; full property management; master lease/sublease; commercial partitioning; company operations; owner and tenant servicing.
Architecture baseline Single-company, multi-branch, business-model-aware modular monolith with internal and external portals.
Financial baseline Manual and digital payment recording with auditable property accounting
Status Approved planning baseline; local legal and accounting review required before production

Important legal note
This documentation defines a configurable software platform. Lease wording, eviction procedures, deposit handling, taxes, licensing, privacy, consumer protection and accounting treatment must be reviewed against the laws and practices of the country where the company operates.

Revision History
Version Date Change Author
1.0 04-Aug-2026 Initial complete documentation baseline Project Documentation Team
2.0 07-Aug-2026 Business-model-aware redesign: brokerage-only lifecycle, full-management automation, master lease/sublease, rentable-space hierarchy, commercial partitioning, area-based pricing, shared utilities and vacant-land specialization. Project Documentation Team

How to Use This Document
The document is intentionally comprehensive. Business owners should begin with Parts I–IV; product and design teams with Parts V–VIII; engineering teams with Parts IX–XIV; QA, security and operations teams with Parts XV–XVIII. The glossary and traceability sections support shared terminology and implementation control.
Table of Contents
• 1. Executive Summary
• 2. Vision, Objectives and Success Measures
• 3. Business Context and Operating Models
• 4. Scope, Assumptions and Constraints
• 5. Stakeholders, Actors and Governance
• 6. Business Requirements (BRD)
• 7. Product Requirements (PRD)
• 8. Functional Requirements by Module
• 9. End-to-End Business Workflows
• 10. Business Rules and State Models
• 11. Roles, Permissions and Approval Matrix
• 12. Information Architecture and User Experience
• 13. Data Model and Database Blueprint
• 14. API and Integration Specification
• 15. Accounting and Financial Control Design
• 16. Non-Functional, Security and Privacy Requirements
• 17. Reporting, Analytics and KPIs
• 18. Testing, Acceptance and Quality Assurance
• 19. Deployment, Operations and Disaster Recovery
• 20. Implementation Roadmap and Backlog
• 21. Risks, Decisions and Future Scope
• 22. Glossary, References and Traceability
 

1. Executive Summary
   The proposed solution is a centralized operating system for a real-estate company that acquires property-management mandates, markets rental inventory, converts prospects into tenants, administers leases, collects rent, manages maintenance, accounts for owner funds, pays owners, coordinates staff and vendors, and reports performance across branches and portfolios.
   Core definition
   This is not merely a property listing website and not a personal landlord app. It is the company’s system of record for the complete property lifecycle—from owner acquisition and property onboarding through leasing, recurring operations, financial settlement, renewal and move-out.

1.1 Business Outcomes
• One trusted record for every owner, property, building, unit, tenant, lease and transaction.
• Accurate separation of company funds, owner funds and security deposits.
• Faster lead-to-lease conversion with controlled follow-up and viewing workflows.
• Higher rent collection through schedules, reminders, allocation and aging.
• Transparent owner statements and auditable payouts.
• Traceable maintenance from request to approval, work completion and cost allocation.
• Measurable branch, property, employee, agent and vendor performance.
• Reduced fraud and errors through approvals, segregation of duties and immutable audit trails.
1.2 Solution Surfaces
Surface Primary users Purpose
Internal operations portal Executives, branch managers, agents, accountants, property managers, support staff Full company workflow and administration
Owner portal Property owners and authorized representatives Portfolio, financial, lease, maintenance, document and payout transparency
Tenant portal Applicants, tenants and co-tenants Applications, leases, balance, payments, receipts, requests and notices
Vendor portal Technicians and service companies Assigned work, quotations, schedules, evidence and invoices
Public property website Prospective tenants Search, inquiry, viewing request and application entry

2. Vision, Objectives and Success Measures
   2.1 Vision Statement
   To provide a reliable, secure and locally adaptable platform that enables a rental real-estate company to operate professionally at scale while protecting owner funds, improving tenant service and giving management timely control over financial and operational performance.
   2.2 Strategic Objectives
   Objective Definition
   Operational control Standardize processes across branches and reduce dependence on spreadsheets, personal phones and informal records.
   Financial integrity Make every charge, payment, fee, expense, deposit and payout explainable and reconcilable.
   Growth Support portfolio growth without proportional administrative headcount growth.
   Customer trust Give owners and tenants clear records, documents, status updates and service history.
   Risk reduction Enforce access controls, approvals, document evidence, audit logs and data retention.
   Decision quality Expose actionable KPIs for occupancy, collection, leasing, maintenance and profitability.

2.3 Success Metrics
Area Metric Initial target
Leasing Median days from qualified lead to signed lease ≤ 14 days for ready residential units
Occupancy Occupied rentable units / active rentable units ≥ 90% portfolio target, configurable
Collections Cash collected / charges due for period ≥ 95% by month close
Maintenance Urgent requests acknowledged within SLA ≥ 95%
Owner reporting Statements issued on scheduled date 100%
Accounting Unreconciled bank/mobile-money items older than 7 days 0 critical items
Data quality Active leases without signed documents or required payments 0
Security Privileged actions without audit event 0

3. Business Context and Operating Models
   3.1 Supported Property Portfolios
   • Single-family homes, villas and compounds
   • Apartments and multi-unit residential buildings
   • Rooms and shared housing
   • Furnished and serviced long-term units
   • Offices, shops, warehouses and commercial buildings
   • Mixed-use buildings
   • Land or parking/storage spaces where rental administration is required
   3.2 Supported Commercial Arrangements
   Model How it works Typical income
   Full-service property management Company markets, leases, collects, maintains, reports and pays the owner. Percentage or fixed management fee plus optional service fees.
   Tenant placement only Company sources and places a tenant, then hands management back to owner. One-time placement commission.
   Rent collection only Company administers charges and collections but limited operations. Collection fee or fixed monthly fee.
   Maintenance/inspection service Company coordinates maintenance and inspections without leasing. Per-job fee or subscription.
   Company-owned property The company owns the property and keeps net operating income. Rent is company revenue.
   Master lease/sublease Company rents from owner at agreed cost and sublets units. Spread between tenant rent and master lease cost.
   Brokerage Company facilitates a transaction but does not administer the ongoing lease. Brokerage commission.

3.3 Revenue Categories
• Management fee
• Tenant placement commission
• Lease preparation or administration fee
• Renewal fee
• Viewing or transport fee where permitted
• Inspection fee
• Marketing fee
• Maintenance coordination fee or disclosed markup
• Company-owned rent
• Late fee share where contractually and legally permitted
• Valuation or advisory service fee
3.4 Cost Categories
• Payroll and commissions
• Office and branch costs
• Marketing and advertising
• Transport and fuel
• Technology and communications
• Professional and legal services
• Property-specific maintenance and utilities
• Vendor bills
• Bank and payment-provider fees
• Insurance and taxes where applicable
3.5 Foundational Domain Principle: Property Type Is Not the Business Model
Critical Architecture Decision
The system must always separate WHAT is being rented from HOW the company earns from or manages it. Property type describes the physical asset or rentable space. Service model describes the company’s commercial relationship and therefore determines which workflows, accounting rules and modules are enabled.
• Property / space type examples: HOUSE, VILLA, APARTMENT, ROOM, FLOOR, OFFICE, SHOP, HALL, BOOTH, WAREHOUSE, LAND, PARKING_SPACE and STORAGE_SPACE.
• Service model examples: BROKERAGE_ONLY, TENANT_PLACEMENT, FULL_MANAGEMENT, MASTER_LEASE_SUBLEASE, COMPANY_OWNED and RENT_COLLECTION_ONLY.
• A shop can be brokerage-only, full-management or company-owned. A floor can be master-leased and subdivided. A land parcel can use a long-term lease without residential attributes.
• Feature availability must be policy-driven by service model rather than inferred only from property type.
3.6 Service-Model Capability Matrix
Capability Brokerage Only Full Management Master Lease / Sublease Vacant Land
Public listing / CRM / viewing Yes Yes Yes Yes
Recurring tenant invoices No Yes Yes Configurable by lease
Owner payout cycle No Yes No in the normal case Depends on arrangement
Maintenance operations No company lifecycle Yes Yes Off by default
Tenant ledger Deal-level only Yes Yes Configurable
Shared utilities No Optional Yes Normally no
Parent-child rentable spaces Optional Supported Required where subdivided Normally no
Area-based pricing Optional Optional Supported Supported
Profit model One-time commission Fees + managed-property economics Sublease spread / margin Configured lease income
Post-deal status RENTED_EXTERNAL OCCUPIED / MANAGED OCCUPIED / SUBLEASED LEASED
3.7 Brokerage / One-Time Deal Operating Model
• Purpose: the company markets or sources a property, brings the client, closes the rental transaction and earns a one-time brokerage commission.
• The brokerage transaction ends after deal settlement and handoff; the company does not become the ongoing property manager unless the service model is explicitly upgraded.
• When the agreement is signed or the deal reaches the configured completion event, the rentable space automatically becomes RENTED_EXTERNAL and is removed from active availability/search results.
• The system must not create monthly rent invoices, owner payouts, recurring owner statements or managed-maintenance workflows for brokerage-only deals.
• The system must retain owner, property, lead, viewing, negotiation, signed agreement, brokerage commission, agent commission, receipt and deal profitability records.
• If the property later returns to market, an authorized user may reopen availability through a controlled status transition without deleting historical deal records.
Brokerage lifecycle Required behavior
AVAILABLE Property can appear in active listings and matching.
RESERVED Temporarily held while deal terms are being finalized.
DEAL_PENDING Agreement or commission settlement is pending.
RENTED_EXTERNAL Deal completed; property is no longer available and no recurring management processes run.
CANCELLED / ARCHIVED Deal or listing is closed without ongoing operational activity.
3.8 Full-Management Operating Model
• Purpose: the company actively manages the property throughout the lease lifecycle on behalf of the owner.
• The lease can generate recurring invoices or charges for rent and other configured items such as water, electricity, service charges, parking or internet.
• Collected income is tracked against property and owner ledgers; approved property expenses and maintenance costs are deducted according to the management agreement.
• The company fee engine calculates percentage or fixed management fees and other disclosed fees, after which the system calculates owner net payable.
• Maintenance tickets, work orders, inspections, complaints, renewals, move-out, deposit settlement, owner statements and payouts remain active for the managed lifecycle.
3.9 Master Lease and Subleasing Operating Model
• Purpose: the company rents a parent space from the property owner under a master lease and then rents child spaces to one or more subtenants.
• The system must maintain the master lease obligation separately from sublease revenue. The company is the payer on the master lease and the payee/landlord-side operator on subleases.
• Parent and child rentable spaces must be linked so a floor, hall or larger unit can be subdivided without creating a fictitious new building.
• Profitability must compare sublease revenue against master rent, shared utilities, maintenance and other directly attributable costs.
• The system must support vacant child spaces, different child rents, different lease dates and multiple subtenants while the master lease remains active.
Master-Lease Margin Formula
Sublease operating margin = total sublease revenue − master lease cost − shared utilities − direct maintenance/operating costs − other attributable expenses. Reports must preserve each component rather than storing only the final margin.
3.10 Commercial Partitioning and Rentable-Space Model
• Commercial spaces must use a generic RentableSpace concept capable of representing a floor, hall, shop, booth, office, room or other leasable area.
• A RentableSpace may have parentSpaceId and multiple child spaces. This allows a single hall to be divided into shops/booths without creating a new building record.
• The sum of active child-space areas must not exceed the parent usable area unless an authorized override with reason is recorded.
• Spaces can be split, merged or retired. Historical spaces referenced by signed leases must never be deleted; their lifecycle state must preserve the original commercial arrangement.
• Supported pricing methods include FIXED_MONTHLY, PER_SQM_MONTHLY, PER_SQM_YEARLY and NEGOTIATED.
• Commercial contract templates can include business identity, permitted use, fit-out period, rent-free period, signage rights, operating hours, insurance, common-area charges, escalation and subletting restrictions.
3.11 Vacant-Land Leasing Model
• Vacant land uses a simplified attribute set: land size, area unit, dimensions/boundaries, location, permitted use, current use, rent, deposit, access details and documents.
• Residential-only fields such as bedrooms, bathrooms, kitchens, furniture and floor numbers must be hidden and not required.
• Maintenance is disabled by default for land leases, but may be enabled by configuration for fencing, gates, lighting, drainage or similar site obligations.
• Long-term land leases must support multi-year terms, renewal options, rent-review dates, escalation dates, notice deadlines and configurable expiry alerts.
• Typical use classifications may include parking, garage/yard, storage, commercial yard, equipment staging or other approved land use. 4. Scope, Assumptions and Constraints
4.1 In Scope for Core Product
• Company, branch and department setup
• Employees, roles, permissions and approval policies
• Owner CRM, verification and management agreements
• Property/building/unit onboarding and status management
• Listings, lead CRM, inquiries, follow-ups and viewings
• Applications, screening records, reservation and tenant conversion
• Lease drafting, approval, signature tracking, activation, renewal and termination
• Move-in and move-out inspections, keys, meters and inventories
• Recurring charges, invoices, manual/digital payments, allocation, receipts and tenant ledger
• Security deposits and refunds
• Property accounting, company fees, expenses, owner statements and payouts
• Maintenance, vendors, quotations, work orders, preventive schedules and asset records
• Complaints, violations, notices, communications, tasks and notifications
• Dashboards, reports, exports, audit logs and system configuration
4.2 Deferred / Future Scope
• Property sales and conveyancing
• Construction project management
• Full hotel/nightly booking engine
• Full payroll and HR suite
• Advanced investment fund accounting
• IoT building automation and smart locks
• AI-only approval or rejection of tenants
• Cryptocurrency and blockchain contracts
4.3 Key Assumptions
• The initial product serves one real-estate company with multiple branches, not multiple unrelated SaaS customer companies.
• The company may manage both owner-owned and company-owned properties.
• Payments may be recorded manually from cash, bank transfer, EVC Plus, eDahab or other channels; payment integrations can be added later.
• Local lease, tax and deposit rules are configurable and require professional review.
• Most staff access is online, while selected field operations may later support offline capture.
• USD is the default currency; optional multi-currency support retains transaction currency and exchange rate.
4.4 Constraints
• Financial records must remain auditable; posted transactions cannot be casually edited or deleted.
• A unit cannot have conflicting active occupancy unless a defined shared-unit model permits it.
• Owner bank/mobile-money changes and high-risk transactions require verification.
• Signed documents require version preservation.
• Branch-level segregation and least-privilege access are mandatory. 5. Stakeholders, Actors and Governance
5.1 Stakeholder Register
Stakeholder Primary interest System responsibility
Company owners/directors Growth, risk, profit and governance Approve strategy and major controls
General manager Operational performance Own company workflows and policy
Branch manager Branch delivery and accountability Approve branch operations within limits
Property manager Portfolio condition and owner/tenant service Manage assigned properties and leases
Leasing agent Lead conversion and commission Manage pipeline, viewings and leasing
Accountant/finance manager Accuracy, control and reporting Post, reconcile, close and report
Maintenance coordinator Issue resolution and cost control Triage and manage work orders
Inspector Property condition evidence Perform structured inspections
Customer service Communication and complaint handling Register and route service interactions
Owner Asset performance and transparent funds Approve where required and receive reports
Tenant/applicant Fair, clear and responsive rental service Provide information, pay and comply
Vendor Clear assignments and timely payment Quote, complete and evidence work
IT/support Availability and security Operate, monitor and support platform

5.2 Governance Bodies
• Product Steering Committee: scope, priorities and policy decisions.
• Financial Control Committee: chart of accounts, close, reconciliation, write-offs and payout policies.
• Operational Review: occupancy, collections, maintenance SLAs, complaints and branch performance.
• Security and Change Review: privileged access, incidents, releases and integrations.
5.3 RACI Summary
Process Responsible Accountable Consulted Informed
Owner onboarding Property manager Branch/General manager Legal, finance Owner
Property activation Property manager Branch manager Leasing, inspector Owner
Tenant approval Leasing/property manager Configured approver Owner if agreement requires Applicant
Lease activation Leasing + finance Branch manager Property manager Owner and tenant
Owner payout Accountant Finance manager Property manager Owner
Emergency maintenance Maintenance coordinator Property/branch manager Owner where possible Tenant
Period close Accountant Finance manager Branch managers Executives

6. Business Requirements Document (BRD)
   ID Domain Business requirement
   BR-001 Organization The company shall manage one or more branches, departments, portfolios and operating accounts.
   BR-002 Access The company shall restrict records and actions by role, branch, portfolio, assignment and approval authority.
   BR-003 Owners The company shall maintain verified owner identities, ownership shares, communication preferences, agreements and payout instructions.
   BR-004 Properties The company shall model property, building and rentable-unit hierarchies for residential, commercial and mixed portfolios.
   BR-005 Availability The company shall know the current operational, marketing and occupancy status of every rentable unit.
   BR-006 CRM The company shall capture every owner and tenant lead, source, assignment, activity, next action and outcome.
   BR-007 Leasing The company shall control the lead-to-lease lifecycle, including viewing, application, verification, approval, reservation and contract.
   BR-008 Lease administration The company shall preserve lease versions, parties, charges, notices, renewal and termination history.
   BR-009 Collections The company shall generate due charges, receive and allocate payments, issue receipts and track arrears.
   BR-010 Deposits The company shall track security deposits separately from income and produce an auditable deduction/refund calculation.
   BR-011 Owner funds The company shall calculate owner balances, fees, deductions, reserves, statements and payouts accurately.
   BR-012 Maintenance The company shall manage requests, responsibility, approvals, vendors, quotations, work orders, evidence and costs.
   BR-013 Accounting The company shall maintain auditable property and company financial records with period controls and reconciliations.
   BR-014 Service The company shall track complaints, notices, communications and SLA performance.
   BR-015 Documents The company shall securely store and version owner, property, tenant, lease, inspection and financial documents.
   BR-016 Reporting The company shall provide role-relevant dashboards, reports, filters and exports.
   BR-017 Audit The company shall record sensitive user actions and data changes in tamper-resistant audit logs.
   BR-018 Localization The platform shall support Somali and English, local addresses and configurable payment methods.
   BR-019 Scale The platform shall support portfolio and branch growth without redesigning core concepts.
   BR-020 Continuity The platform shall support backup, recovery, monitoring and controlled deployment.

7. Product Requirements Document (PRD)
   7.1 Product Personas
   Persona Need Product response
   Executive Amina Needs portfolio and branch performance without operational detail. Executive scorecard, exceptions, approvals and drill-down reports.
   Property Manager Ali Coordinates owners, tenants, units, inspections and maintenance. Portfolio workspace, task list, lease alerts and service timeline.
   Leasing Agent Hodan Works quickly from phone and follows many prospects. Pipeline, matching, viewings, activity reminders and commission visibility.
   Accountant Yusuf Requires precise ledgers and controlled postings. Finance workspace, reconciliation, period close and exception queues.
   Owner Fatima Wants trust and transparency. Owner portal with statements, transactions, maintenance and documents.
   Tenant Abdi Wants clear balance and fast service. Tenant portal with lease, receipts, notices and maintenance requests.

7.2 Product Principles
• One source of truth: each real-world entity has a controlled master record.
• Workflow before freedom: high-risk processes use states, approvals and evidence.
• Financial entries are posted, reversed and reconciled—not silently edited.
• Mobile-first field work; desktop-efficient finance and administration.
• Exception-driven dashboards show what needs attention.
• Portals expose appropriate information without exposing internal notes or controls.
• Configuration is preferred over hard-coded local rules.
7.3 Primary User Journeys

1. Acquire and onboard an owner/property.
2. Publish a ready unit and convert an inquiry into a tenant.
3. Activate a lease and complete move-in.
4. Run the monthly rent, fee and owner-payout cycle.
5. Resolve a maintenance request with financial responsibility.
6. Renew or end a lease and settle the deposit.
7. Close the accounting period and produce management reports.
   7.4 Release Definition
   Release Goal Included capability
   MVP Run essential company operations reliably Organization, RBAC, owners, properties, CRM, leasing, charges, payments, deposits, maintenance, expenses, owner statements/payouts, reports and audit
   Phase 2 Increase self-service and financial maturity Owner/tenant/vendor portals, digital signature, full GL, reconciliation, preventive maintenance, budgets and integrations
   Phase 3 Optimize and scale Mobile/offline field apps, advanced BI, intelligent matching, forecasting and selective automation

8. Functional Requirements by Module
   8.1 Organization and Configuration
   • Create and update company identity, language, currency, timezone and numbering rules.
   • Create branches, departments, portfolios and cost centers.
   • Configure property, unit, charge, expense, document, maintenance and communication categories.
   • Configure approval thresholds, SLAs, lease alerts and fee rules.
   8.2 Identity, Authentication and Access
   • Invite, activate, suspend and deactivate staff accounts.
   • Support secure password login and optional MFA for privileged users.
   • Assign multiple roles with branch, portfolio or property scope.
   • Display active sessions and allow revocation.
   • Require re-authentication for selected high-risk actions.
   8.3 Owner and Agreement Management
   • Register individual, joint and corporate owners.
   • Record ownership shares and authorized representatives.
   • Verify identity, ownership and payout details.
   • Draft, approve, sign, renew and terminate management agreements.
   • Configure fee schedules, reserve rules, expense thresholds and owner approval requirements.
   8.4 Property, Building and Unit Management
   • Support property-to-building-to-unit hierarchy and single-unit properties.
   • Track physical, utility, amenity, commercial and document attributes.
   • Assign branch, property manager and owner relationships.
   • Manage operational, marketing and occupancy statuses independently.
   • Prevent invalid availability and occupancy transitions.
   • Use a generic RentableSpace hierarchy for physical spaces that can be leased independently; a rentable space may be attached directly to a property/building/floor or to another rentable space.
   • Support parent-child partitioning, splitting, merging and retiring of spaces while preserving historical lease references.
   • Store area, usable area, area unit, pricing method, rate per area and capacity where relevant.
   • Drive forms and required fields by space/property type so land, residential and commercial records do not share irrelevant mandatory attributes.
   • Attach a service model to the relevant property/space engagement so workflow eligibility can be enforced centrally.
   8.5 Listings and Marketing
   • Create listing content from an available unit.
   • Approve and publish to company channels.
   • Track publication status, views, inquiries and source attribution.
   • Pause, expire or unpublish listings automatically when reserved or occupied.
   8.6 CRM and Leads
   • Capture tenant and owner leads from all channels.
   • Assign leads and track every activity, next action and outcome.
   • Store requirements and match suitable units.
   • Detect duplicates by phone/email and preserve source history.
   • Measure pipeline conversion and response times.
   8.7 Viewings
   • Schedule, confirm, reschedule and cancel viewings.
   • Assign an agent and capture access/key readiness.
   • Record attendance, fees, feedback and next action.
   • Create application directly from a successful viewing.
   8.8 Applications and Screening
   • Collect applicant, household, employment, income, reference and document data.
   • Run configurable checks and record verification evidence.
   • Support internal and optional owner approval.
   • Record reason codes for rejection or withdrawal.
   • Convert approved applications into reservations and tenant profiles.
   8.9 Reservations
   • Temporarily hold a unit with expiry and payment terms.
   • Prevent conflicting reservations and leases.
   • Convert reservation funds according to configurable policy.
   • Expire and return unit to market automatically.
   8.10 Lease Administration
   • Draft leases using templates and variables.
   • Manage tenants, co-tenants, occupants, guarantors and witnesses.
   • Define rent, deposit, service charges, due dates, escalation, notices and special terms.
   • Preserve signed versions and amendments.
   • Activate, renew, terminate, cancel or archive through controlled states.
   8.11 Move-In and Move-Out
   • Verify prerequisites before move-in.
   • Record condition, inventory, keys, access devices and meter readings.
   • Capture signatures and evidence.
   • Manage notice, final inspection, charges, deposit settlement and unit turnover.
   8.12 Charges, Invoices and Payments
   • Generate recurring and one-time charges.
   • Support proration, escalation, credits and adjustments.
   • Record cash, bank, mobile-money and integrated payments.
   • Allocate one payment across multiple charges.
   • Handle partial, advance, overpayment, refund and reversal.
   • Generate immutable receipt references.
   8.13 Receivables and Collections
   • Maintain tenant ledger and aging.
   • Send due and overdue reminders.
   • Create payment plans and collection tasks.
   • Track notices, promises to pay and escalation.
   8.14 Security Deposits
   • Record required and received deposits in a separate ledger.
   • Support top-ups, deductions, disputes, refunds and approval.
   • Prevent refunds exceeding the held balance.
   • Produce final deposit accounting.
   8.15 Property Accounting and Owner Settlement
   • Separate company, owner and tenant-deposit funds.
   • Calculate management and service fees from agreements.
   • Record property income, bills, expenses, reserves and owner contributions.
   • Generate owner statements and payout proposals.
   • Approve, pay and reconcile owner payouts.
   8.16 Expenses, Procurement and Vendors
   • Register vendors and approved services.
   • Create expense requests, quotations, purchase orders and vendor bills.
   • Apply amount and responsibility approvals.
   • Allocate shared bills across properties or units.
   • Track vendor performance and payment status.
   8.17 Maintenance and Assets
   • Allow requests from staff, tenants, owners and scheduled maintenance.
   • Triage category, priority, responsibility and access.
   • Assign vendors, collect quotations and issue work orders.
   • Capture before/after evidence, completion verification and cost.
   • Schedule preventive maintenance and track property assets.
   8.18 Inspections
   • Configure inspection templates and sections.
   • Support onboarding, move-in, routine, safety, maintenance and move-out inspections.
   • Capture condition ratings, notes, photos, meters and signatures.
   • Compare move-in and move-out evidence.
   8.19 Complaints, Violations and Notices
   • Register service complaints separately from repair requests.
   • Assign, investigate, resolve and escalate complaints.
   • Record lease violations, evidence, cure dates and outcomes.
   • Generate controlled notice documents and communication history.
   8.20 Documents and Communications
   • Store private documents with entity links, versions and expiry.
   • Generate documents from templates.
   • Send email, SMS, WhatsApp or in-app messages through configured providers.
   • Maintain delivery status and communication timeline.
   8.21 Tasks, Notifications and Approvals
   • Create manual and automated tasks tied to records.
   • Configure reminders, escalations and SLA timers.
   • Support sequential, parallel and amount-based approvals.
   • Provide approver inbox and full decision history.
   8.22 Dashboards, Reports and Audit
   • Provide role-based dashboards and exception queues.
   • Generate operational and financial reports with filters and exports.
   • Log sensitive actions, approvals, before/after changes and access events.
   8.23 Brokerage Deal Management
   • Create and approve one-time brokerage deals linked to owner, rentable space, lead/client and responsible agent.
   • Configure commission as fixed amount, percentage, first-month-rent equivalent or approved custom formula.
   • Track gross brokerage commission, company share, agent share, taxes/fees where applicable, receipts and settlement status.
   • Automatically close active marketing availability when the completed deal transitions the space to RENTED_EXTERNAL.
   • Prevent recurring management jobs from being generated for brokerage-only deals.
   8.24 Master Lease, Sublease and Shared Utilities
   • Maintain master-lease contracts separately from sublease contracts and link both to the relevant parent/child rentable spaces.
   • Generate master rent obligations payable by the company and sublease receivables due from subtenants.
   • Provide profitability by master lease, parent space and child space.
   • Support shared utility bills and allocation rules: EQUAL, AREA_BASED, METERED, OCCUPANCY_BASED, FIXED_AMOUNT and CUSTOM_PERCENTAGE.
   • Create allocated child charges from an approved shared bill with full traceability back to the source bill and allocation rule.
   • Prevent allocations from exceeding the approved source bill unless an authorized adjustment is posted.
   8.25 Commercial Space and Land Specialization
   • Provide commercial space partitioning, area-based pricing and commercial contract templates.
   • Provide simplified land forms and long-term lease alerts without residential-only data requirements.
   • Allow space-type-specific validations, document requirements, billing logic and reporting.
9. End-to-End Business Workflows
   9.1 Owner and Property Acquisition
10. Create owner lead and capture source.
11. Qualify service need and property type.
12. Verify owner identity and authority.
13. Register draft property and schedule inspection.
14. Complete condition, compliance and rental assessment.
15. Prepare service proposal and fee schedule.
16. Negotiate and approve management agreement.
17. Sign agreement and collect required documents/reserve.
18. Create full property/building/unit records.
19. Assign branch and property manager.
20. Set readiness actions and activate eligible units.
    9.2 Lead-to-Lease
21. Capture inquiry and requirements.
22. Deduplicate and assign agent.
23. Contact and qualify prospect.
24. Match and propose available units.
25. Schedule and complete viewing.
26. Record feedback and follow-up.
27. Submit application and documents.
28. Complete checks and approvals.
29. Negotiate final rent and terms.
30. Create reservation where required.
31. Generate and approve lease.
32. Collect signatures, deposit and first charges.
33. Complete move-in and activate lease.
    9.3 Monthly Rent Cycle
34. Generate recurring charges before due date.
35. Send upcoming-due reminders.
36. Receive payment and verify reference.
37. Allocate payment to open charges.
38. Issue receipt and update tenant ledger.
39. Age unpaid balances and trigger collection workflow.
40. Post applicable management fees and property expenses.
41. Reconcile collection accounts.
42. Generate owner statement and payout proposal.
43. Approve and execute owner payout.
44. Close reporting period.
    9.4 Maintenance
45. Receive request and acknowledge.
46. Triage urgency and safety.
47. Determine responsibility and approval path.
48. Assign internal technician or request vendor quotations.
49. Approve quotation and schedule access.
50. Issue work order and track progress.
51. Capture completion evidence and tenant/manager verification.
52. Approve bill and post cost to correct party/property.
53. Close request and rate service.
    9.5 Lease Renewal
54. Detect lease approaching configured threshold.
55. Review tenant balance, conduct and property condition.
56. Review market rent and owner instructions.
57. Prepare renewal proposal.
58. Send offer and record response.
59. Negotiate within authorization limits.
60. Approve and sign renewal/amendment.
61. Generate new charge schedule and preserve prior version.
    9.6 Move-Out and Deposit Settlement
62. Receive or issue valid notice.
63. Check notice period and calculate expected final obligations.
64. Schedule pre-move-out and final inspection.
65. Recover keys and final meter readings.
66. Compare condition evidence and identify chargeable items.
67. Post final rent, utility, damage or cleaning charges.
68. Approve deposit deductions and issue statement.
69. Refund deposit or collect remaining balance.
70. Close lease and tenant occupancy.
71. Complete turnover work and reactivate listing.
    9.7 Owner Payout
72. Close/verify collection transactions for payout period.
73. Calculate owner gross income.
74. Deduct agreed management/service fees, approved property costs and reserve top-ups.
75. Generate draft owner statement.
76. Finance reviews supporting transactions and reconciliation.
77. Authorized manager approves payout.
78. Execute payment to verified owner account.
79. Attach transaction reference and notify owner.
80. Reconcile payout and lock statement version.
    9.8 Brokerage-Only Deal Closure
81. Register or verify the owner and rentable space, select BROKERAGE_ONLY and publish/market the space.
82. Capture lead, viewing, negotiation and proposed deal terms.
83. Prepare or upload the signed rental/brokerage agreement and calculate brokerage commission.
84. Collect/record commission and agent share according to policy.
85. Complete the deal, automatically transition the space to RENTED_EXTERNAL and remove it from availability.
86. Close the brokerage workflow without creating recurring rent, owner payout, maintenance or monthly statement jobs.
    9.9 Full-Management Monthly Automation
87. Identify active managed leases for the billing period.
88. Generate recurring rent and configured utility/service charges.
89. Receive, verify and allocate tenant payments.
90. Post property income and approved expenses.
91. Calculate management fees and other disclosed company charges.
92. Calculate owner payable, issue statement, obtain approval and record payout.
93. Carry forward receivables, credits, reserves and unresolved exceptions.
    9.10 Master Lease / Sublease Profit Cycle
94. Post or generate the master-lease rent obligation payable by the company.
95. Generate sublease charges for each active child-space lease.
96. Allocate shared utilities and common costs using approved allocation rules.
97. Record collections, vacancies, direct expenses and master-rent payments.
98. Calculate gross sublease revenue, master cost, shared costs and operating margin.
99. Report profitability by parent space and by child space without netting away source transactions.
    9.11 Commercial Space Partitioning
100. Create or select an existing parent hall/floor/space and record total/usable area.
101. Define child spaces with unique space codes, areas, use type and pricing method.
102. Validate total child area against parent usable area.
103. Activate child spaces for listing and leasing while retaining parent-space context.
104. When layout changes, split/merge/retire spaces through versioned operations rather than deleting leased history.
     9.12 Long-Term Land Lease
105. Register simplified land details and the permitted rental use.
106. Create the long-term lease with term, rent schedule, escalation/rent-review dates and notice deadlines.
107. Generate only the configured billing schedule; do not require residential features.
108. Send expiry and review alerts at configured intervals such as 365, 180, 90, 60, 30 and 7 days.
109. Renew, terminate or expire the lease through controlled state transitions while preserving history.
110. Business Rules and State Models
     ID Rule
     BUS-001 A rentable unit may have at most one active exclusive lease for overlapping dates.
     BUS-002 A property may have multiple owners; ownership allocation must total 100% unless a pending-verification state is used.
     BUS-003 An occupied unit cannot be marketed as available.
     BUS-004 A lease cannot activate until required signatures and configured initial payments are complete or formally waived.
     BUS-005 Signed lease content is immutable; corrections require amendment, replacement version or cancellation workflow.
     BUS-006 A posted payment cannot be deleted; it may only be reversed with reason and approval.
     BUS-007 Payment allocation cannot exceed available payment balance or open charge balance.
     BUS-008 The same external payment reference cannot be used twice without privileged duplicate-review approval.
     BUS-009 Security deposits are tracked separately from rent and company income.
     BUS-010 Deposit refund plus deductions cannot exceed deposit held, except a separate tenant receivable is created.
     BUS-011 Owner payout cannot exceed verified owner-available balance after reserves and holds.
     BUS-012 Company management fees must derive from an active agreement or approved override.
     BUS-013 Property expenses must identify financial responsibility: owner, tenant, company, shared, warranty or insurer.
     BUS-014 Closed accounting periods cannot be edited; corrections use adjusting entries in an open period.
     BUS-015 Owner payout account changes require verification and cannot immediately bypass configured hold period.
     BUS-016 Maintenance emergencies may bypass normal approval only with mandatory reason, notification and subsequent review.
     BUS-017 Applications and screening outcomes must retain evidence and reason codes; automated suggestions do not replace authorized human decisions.
     BUS-018 Archived master records remain referentially available to historical leases and transactions.
     BUS-019 Sensitive internal notes are never exposed to external portals unless explicitly classified as shareable.
     BUS-020 Every privileged permission, financial reversal, approval and document-signing event must produce an audit event.

10.1 Principal State Models
Entity Typical states
Property Draft → Verification → Inspection → Onboarding → Active → Suspended/Offboarded → Archived
Unit Draft → Preparing → Available → Reserved → Occupied → Notice/Turnover → Available → Inactive
Lead New → Assigned → Contacted → Qualified → Viewing/Application → Converted or Lost
Application Draft → Submitted → Verification → Review → Approved/Rejected/Withdrawn
Lease Draft → Approval → Signature → Payment Pending → Active → Renewal/Notice → Expired/Terminated → Archived
Payment Draft → Verification → Posted → Partially/Fully Allocated → Reversed where required
Maintenance Submitted → Triage → Approval/Quotation → Assigned → In Progress → Verification → Closed
Owner payout Draft → Review → Approval → Processing → Paid/Reconciled or Cancelled/Held

10.2 Service-Model Eligibility Rules
• BROKERAGE_ONLY must never create recurring rent invoices, owner payouts, recurring owner statements or managed-maintenance work unless the service model is formally changed.
• FULL_MANAGEMENT enables recurring billing, managed maintenance, owner statements, owner payouts, inspections and managed lease lifecycle workflows.
• MASTER_LEASE_SUBLEASE requires an active master lease before dependent sublease profitability can be finalized.
• A service-model change must be effective-dated, approved where configured and audit logged; historical transactions keep the original model context.
10.3 Rentable-Space Integrity Rules
• Each independently leasable child space must have a stable unique code within its parent context.
• Active child-space area totals cannot exceed parent usable area without approved override evidence.
• A space referenced by a signed or historical lease cannot be hard deleted.
• Split/merge operations create successor/predecessor relationships so historical reporting remains explainable.
• An exclusive rentable space cannot have overlapping active occupancy unless the product explicitly supports shared occupancy for that space type.
10.4 Billing and Utility Rules
• Area-based rent must store both the rate and the area basis used for the calculation.
• Shared utility allocations must preserve source bill amount, allocation method, factor, recipient spaces and generated charges.
• Allocation rounding differences must be assigned deterministically and reported.
• Changing an allocation rule does not retroactively alter posted allocations; corrections use adjustment/reversal transactions. 11. Roles, Permissions and Approval Matrix
Role Primary access
Super Admin System configuration, all records, access control and audit oversight
General Manager Company-wide operational and approval access
Branch Manager Branch-scoped operations and approvals
Property Manager Assigned portfolios, owners, leases, inspections and service
Leasing Agent Lead, viewing, application and lease-preparation access
Accountant Charges, payments, ledgers, expenses, statements, payouts and reconciliation
Maintenance Coordinator Requests, vendors, quotations and work orders
Inspector Assigned inspections and evidence capture
Customer Service Inquiries, communications, complaints and scheduling
Owner Own portfolio and approved actions through portal
Tenant Own application, lease, payment and service records
Vendor Assigned jobs, quotations, evidence and invoices

11.1 Permission Matrix (Summary)
Module Agent Property Mgr Accountant Branch Mgr Owner Tenant
Leads/Viewings Create/Edit View View Full — Own inquiry
Owners Limited view Full Finance view Full Own profile —
Properties/Units View available Full Finance view Full Own properties Own rented unit
Applications Create/Edit Review Payment view Approve Optional review Own application
Leases Prepare Manage Financial terms Approve View/approve if configured Own lease
Payments View status View Create/Post/Reverse request Approve exceptions View statements Create/view own
Expenses No Request Post Approve View/approve if required View chargeable items
Payouts No View Prepare Approve View own —
Maintenance Create/view Manage Cost view Approve thresholds View/approve Create/view own
Audit/Settings No Limited Finance logs Branch logs/config No No

11.2 Segregation of Duties
• A user should not both create and finally approve their own owner payout above a configured threshold.
• A user who changes owner payout details should not immediately approve a payout to the changed destination.
• Payment entry and bank reconciliation should be separated where staffing permits.
• Vendor onboarding and vendor bill approval should be separated for material amounts.
• System administrators may manage access but should not post financial entries unless explicitly authorized and audited. 12. Information Architecture and User Experience
12.1 Internal Navigation
Navigation area Contents
Dashboard Role scorecard, attention queue and shortcuts
CRM Owner leads, tenant leads, activities, inquiries and viewings
Portfolio Owners, agreements, properties, buildings, units, assets and inspections
Leasing Listings, applications, reservations, tenants, leases, renewals and move-outs
Finance Charges, invoices, payments, deposits, expenses, statements, payouts, accounts and reconciliation
Maintenance Requests, work orders, schedules, vendors and quotations
Service Complaints, violations, notices, communications and tasks
Reports Operational, financial, performance and audit reports
Administration Company, branches, employees, roles, templates, categories, numbering and integrations

12.2 Core Page Inventory
• Login / password recovery / MFA
• Executive dashboard
• Branch dashboard
• Leasing dashboard
• Finance dashboard
• Maintenance dashboard
• Owner list, profile and onboarding workspace
• Property list, property profile, building and unit workspace
• Unit availability board and calendar
• Listing manager and public listing detail
• Lead pipeline, lead profile and activity timeline
• Viewing calendar and mobile viewing checklist
• Application review workspace
• Tenant profile and tenant ledger
• Lease builder, approval, signature and lifecycle timeline
• Move-in and move-out checklist
• Charge/invoice register
• Payment entry, allocation and receipt
• Deposit register and settlement
• Expense/vendor bill register and approval
• Owner statement and payout workspace
• Maintenance request and work-order board
• Inspection form and comparison report
• Vendor directory and performance
• Complaint/violation case page
• Communication center and templates
• Task/approval inbox
• Reports catalog and report viewer
• Audit log viewer
• Company and branch settings
• Roles and permission editor
12.3 UX Standards
• Every list supports search, filters, saved views, pagination and export according to permission.
• Every master record displays a timeline of activities, status changes, documents and financial links.
• Destructive and financial actions show impact, require reason and use confirmation.
• Status labels use both text and visual treatment; color alone is not sufficient.
• Mobile workflows minimize typing and support camera capture.
• Finance tables display currency, posting status, reference and reconciliation state clearly.
• External portals avoid internal terminology and show plain-language next steps. 13. Data Model and Database Blueprint
13.1 Data Domains
Domain Entities
Organization Company, Branch, Department, Portfolio, User, Employee, Role, Permission, ApprovalPolicy
Parties Owner, OwnerRepresentative, Tenant, Occupant, Guarantor, Vendor, ContactMethod, Address
Property Property, PropertyOwner, Building, Unit, Amenity, Asset, Meter, Document
CRM/Leasing Lead, LeadPreference, Activity, Inquiry, Listing, Viewing, Application, ScreeningCheck, Reservation, Lease, LeaseParty, Amendment, Renewal
Finance Account, JournalEntry, JournalLine, Charge, Invoice, Payment, Allocation, Deposit, Expense, VendorBill, OwnerStatement, OwnerPayout, Reconciliation
Operations MaintenanceRequest, WorkOrder, Quotation, Inspection, InspectionItem, Complaint, Violation, Task, Notification, Communication
Control ApprovalRequest, ApprovalDecision, AuditLog, Sequence, Configuration, WebhookEvent, ImportJob

13.2 Key Relationships
• Company has many branches; branch has many employees and assigned properties.
• Owner has many ownership interests; a property has one or more owners through PropertyOwner.
• Property may have buildings and structural levels, while a generic RentableSpace can represent a direct unit, floor, hall, room, shop, booth, land parcel or other independently leasable space. RentableSpace supports parent-child hierarchy.
• RentableSpace has listings, viewings, applications, reservations, deals and leases over time; service model determines which downstream operational workflows are valid.
• Lease has parties, recurring charges, documents, inspections, payments through allocations and deposit transactions.
• Owner statement aggregates owner-property ledger activity for a reporting period.
• Maintenance request may create quotations, work orders, vendor bills, assets and financial transactions.
• All sensitive entities may have documents, tasks, communications, approvals and audit events.
13.3 Representative Table Definitions
Table Key fields Critical constraints
Property id, code, name, type, branchId, managerId, status Unique code; branch required; archived not deleted if referenced
PropertyOwner propertyId, ownerId, sharePercent, effective dates No overlapping share totals above 100%
Unit id, propertyId/buildingId, unitNo, type, rent, statuses Unique unit number within parent; occupancy consistency
Lease id, unitId, start/end, rent, dueDay, status No overlapping active exclusive lease
LeaseCharge leaseId, type, amount, recurrence, effective dates Valid date range and positive configured amount
Payment id, payerId, amount, method, externalRef, status Unique reference policy; posted immutable
PaymentAllocation paymentId, chargeId, amount Allocation sums within payment and charge balances
DepositTransaction leaseId, type, amount, status Refund/deduction bounded by held deposit
OwnerPayout ownerId, period, gross, deductions, net, status Net cannot exceed available payable
WorkOrder requestId, vendorId, approvedAmount, status Approval before non-emergency execution above threshold
JournalEntry date, periodId, sourceType/sourceId, status Balanced debit/credit; posted immutable
AuditLog actor, action, entity, before/after, timestamp Append-only; restricted access

13.3.1 Additional Core Entities Introduced in Version 2
Entity Purpose
ServiceEngagement / ServiceModel Defines brokerage, full management, master lease/sublease, company-owned or collection-only behavior for a property/space relationship.
RentableSpace Generic independently leasable physical space with parent-child hierarchy, area and lifecycle.
SpaceRelationship / SpaceVersion Preserves split, merge, predecessor and successor history.
BrokerageDeal One-time deal, commission, client, agent, settlement and completed status without recurring management.
MasterLease Company obligation to the property owner for a parent space.
Sublease Tenant lease for a child space under a master-leased arrangement.
UtilityBill Source bill for electricity, generator, water or other shared service.
UtilityAllocationRule Defines equal, area, meter, occupancy, fixed or custom allocation basis.
UtilityAllocation Immutable result linking source bill to generated child-space charges.
CommercialLeaseTerms Commercial-specific permitted use, area rate, fit-out, signage, escalation and other terms.
LandLeaseTerms Land-specific use, area, long-term review/escalation dates and notice deadlines.
13.4 Indexing and Integrity
• Unique indexes on company/branch codes, property codes, unit numbers within parent, lease numbers, receipt numbers and configured external references.
• Composite indexes on branch/status, property/status, unit/availability, lease/endDate/status, charge/dueDate/status and maintenance/priority/status.
• Partial unique constraint for one active exclusive lease per unit where supported.
• Foreign-key restrictions prevent deletion of financially or legally referenced records.
• Optimistic concurrency/version columns for records commonly edited by several staff.
• Database transactions wrap payment posting, allocation, fee creation, payout posting and lease activation.
• Index parentSpaceId + status + spaceCode for fast hierarchy and availability queries.
• Enforce unique active space codes within a parent and effective date range.
• Use effective-dated service engagements so business-model transitions do not rewrite history.
• Use database transactions for space split/merge, utility allocation posting and master/sublease financial posting. 14. API and Integration Specification
14.1 API Principles
• REST JSON API with versioned base path, e.g. /api/v1.
• Resource-oriented endpoints plus explicit commands for state transitions.
• Server-side authorization on every request.
• Idempotency keys for payment, payout and integration write operations.
• Consistent validation errors, pagination, filtering and sorting.
• Audit context includes actor, request ID, source and reason.
• Optimistic concurrency for high-contention updates.
14.2 Representative Endpoints
Method Endpoint Purpose
POST /owners Create owner
POST /owners/:id/verify Verify owner
POST /management-agreements Create agreement
POST /management-agreements/:id/approve Approve agreement
POST /properties Create property
POST /properties/:id/units Create unit
POST /units/:id/activate Activate ready unit
POST /listings Create listing
POST /leads Create lead
POST /leads/:id/activities Add activity
POST /viewings Schedule viewing
POST /applications Submit application
POST /applications/:id/approve Approve application
POST /reservations Reserve unit
POST /leases Create lease
POST /leases/:id/activate Activate lease
POST /leases/:id/renew Renew lease
POST /charges/generate Generate recurring charges
POST /payments Record payment
POST /payments/:id/post Post verified payment
POST /payments/:id/reverse Reverse payment
POST /deposits/:id/refund Refund deposit
POST /expenses Create expense
POST /maintenance-requests Create request
POST /work-orders Create work order
POST /owner-statements/generate Generate statements
POST /owner-payouts Prepare payout
POST /owner-payouts/:id/approve Approve payout
GET /reports/rent-roll Rent roll report
GET /audit-logs Search audit log

14.3 Standard Error Model
Field Meaning
code Stable machine-readable error code
message User-safe summary
details Field validation or business-rule details
requestId Trace identifier
timestamp Server timestamp

14.4 Integration Boundaries
Integration Purpose Control
Email/SMS/WhatsApp Notices, reminders and confirmations Template approval, consent/preferences, delivery logs
Payment providers Receive payment confirmation Signature verification, idempotency, reconciliation
Cloud object storage Documents, images and evidence Private-by-default, signed URLs, malware checks
Digital signature Lease and agreement signing Signer identity, hash, timestamp and signed copy
Maps/geocoding Property location Store normalized address and coordinates
Accounting export External accountant or regulatory needs Mapped accounts and immutable export batch
Identity/screening Verification where lawful and available Consent, purpose limitation and human review

14.5 Version 2 Domain Endpoints (Representative)
Area Representative endpoints
Brokerage POST /brokerage-deals; POST /brokerage-deals/:id/complete; POST /brokerage-deals/:id/settle-commission
Rentable spaces POST /rentable-spaces; POST /rentable-spaces/:id/split; POST /rentable-spaces/merge; POST /rentable-spaces/:id/retire
Master lease POST /master-leases; POST /master-leases/:id/activate; GET /master-leases/:id/profitability
Subleases POST /subleases; POST /subleases/:id/activate; GET /master-leases/:id/subleases
Utilities POST /utility-bills; POST /utility-bills/:id/allocate; POST /utility-allocations/:id/reverse
Commercial pricing POST /rentable-spaces/:id/pricing; POST /commercial-leases
Land POST /land-leases; POST /land-leases/:id/renew; GET /land-leases/expiring 15. Accounting and Financial Control Design
15.1 Financial Principles
• Maintain separate conceptual and, where required, physical accounts for company money, owner/client money and deposits.
• Use double-entry accounting for production-grade financial reporting.
• Use accrual or cash recognition rules consistently and configure them with professional accounting review.
• Every source transaction posts balanced journal entries and retains source linkage.
• Posted transactions are corrected through reversal or adjustment.
• Bank and mobile-money accounts are reconciled to external statements.
• Close periods to protect previously issued reports.
15.2 Chart of Accounts – Suggested
Class Examples
Assets Cash, bank, mobile money, tenant receivables, owner advances, prepaid expenses
Liabilities Owner payable, deposits held, tenant credits, vendor payable, taxes payable
Equity Share capital, retained earnings, current-year result
Company income Management fees, leasing commissions, renewal, inspection, maintenance coordination, company-owned rent
Property income Rental income, service charges, recoveries and other owner-attributable income
Expenses Payroll, rent, utilities, marketing, transport, technology, bank fees, maintenance and professional fees

15.3 Transaction Examples
Event Debit Credit
Tenant rent charge Tenant receivable Rental income / owner clearing
Tenant payment received Bank/mobile money/cash Tenant receivable
Management fee charged to owner Owner payable / property expense Management fee income
Owner property expense Property expense / owner ledger Vendor payable or bank
Security deposit received Bank/deposit account Deposit liability
Deposit refund Deposit liability Bank/deposit account
Owner payout Owner payable Bank/mobile money
Payment reversal Original credit account Original debit account

15.4 Owner Statement Formula
Owner Net Payable
Opening owner balance + rent and property income collected + owner contributions − management/service fees − approved property expenses − reserve top-ups − prior payouts ± adjustments = closing owner balance / payout availability.

15.5 Financial Controls
• Daily cash and payment-provider verification.
• Unallocated-payment queue and duplicate-reference monitoring.
• Approval thresholds for expenses, refunds, write-offs and payouts.
• Owner statement review before payout.
• Monthly bank/mobile-money reconciliation.
• Aged receivables review and collection notes.
• Period close checklist and exception report.
• Restricted chart-of-account and opening-balance changes.
15.6 Business-Model-Specific Accounting
Model Accounting treatment
Brokerage only Recognize one-time brokerage income and agent commission/related costs. Do not create owner payable from tenant rent because the company is not administering ongoing rent.
Full management Track tenant receivables, collections, owner/client funds, company management fees, property expenses, reserves and owner payable/payout.
Master lease / sublease Record master rent as a company obligation/cost and sublease rent as company receivable/revenue according to approved accounting policy; report margin separately from cash flow.
Company-owned Rent is company property income; no owner payable exists.
Vacant land Use the configured lease schedule and long-term escalation rules; maintenance and utilities are included only if contractually enabled.
15.7 Master-Lease Profitability and Shared-Utility Controls
• Do not calculate sublease profit merely as cash received minus cash paid; reports must distinguish billed revenue, collected revenue, master rent accrued/paid, vacancy, utilities and direct operating costs.
• Shared utility allocations post traceable child-space charges from one approved source bill and cannot silently change after posting.
• Master-lease profitability reports should show revenue by child space, vacancy loss, master cost, allocated/common costs and operating margin for the selected period. 16. Non-Functional, Security and Privacy Requirements
16.1 Performance and Scale
Requirement Target baseline
Interactive page response Most cached/read operations under 2 seconds under normal load
Search/list APIs 95th percentile under 1.5 seconds for indexed queries
Financial posting Atomic completion or rollback; user receives final status
Report generation Small reports interactive; large reports queued with notification
Availability Target 99.5% monthly for initial production, excluding planned maintenance
Scale baseline Thousands of properties, tens of thousands of units and high-volume transaction history

16.2 Security Requirements
• Strong password hashing and secure reset tokens.
• MFA for super admin, finance leadership and other privileged roles.
• Short-lived access tokens or secure server sessions with rotation and revocation.
• Least privilege, deny-by-default and server-side object-level authorization.
• Encryption in transit and encryption of sensitive secrets/data at rest.
• Private document storage with expiring signed access.
• File type, size and malware validation.
• Rate limiting, brute-force protection and security-event monitoring.
• Audit logs for authentication, authorization failures and sensitive actions.
• Secure secrets management; no production secrets in source control.
• Dependency and container vulnerability scanning.
• Regular backup restore tests and incident response procedures.
16.3 Privacy
• Collect only information required for legitimate rental and company operations.
• Classify data: public, internal, confidential and highly sensitive.
• Restrict ID, income, bank and screening records to authorized purposes.
• Record consent and communication preferences where applicable.
• Define retention and deletion/anonymization schedules subject to legal record requirements.
• Provide controlled data export and correction processes.
• Do not expose internal risk notes or other tenants’/owners’ information in portals.
16.4 Reliability and Observability
• Centralized structured logs with request IDs.
• Metrics for API health, job queues, database, storage, payment integrations and notification delivery.
• Error tracking with alert routing and severity.
• Retry policies with dead-letter queues for background tasks.
• Idempotent jobs for charge generation, notifications and integration events.
• Health checks and automated restart/deployment rollback. 17. Reporting, Analytics and KPIs
17.1 Executive Reports
• Portfolio and unit count
• Occupancy and vacancy trend
• Rent roll and collection rate
• Outstanding receivables aging
• Company revenue and expense trend
• Owner payable and payout status
• Branch comparison
• New and lost management agreements
• Lease renewal and turnover rate
• Critical operational exceptions
17.2 Operational Reports
Area Reports
CRM/Leasing Lead source, response time, pipeline, viewing conversion, application conversion, days on market, agent performance
Portfolio Property register, unit status, availability, occupancy, readiness, lease expiry, inspections due
Tenant Tenant register, balance, payment history, overdue list, notices, move-in/move-out
Finance Rent roll, charge register, payment register, allocation, aging, deposit liability, owner ledger, statement, payout, expense, vendor payable, GL, trial balance, P&L, balance sheet, cash flow, reconciliation
Maintenance Open requests, SLA breaches, emergency incidents, cost by property/category, vendor response, preventive compliance and repeat issues
Governance Approvals pending, audit events, privileged access, data-quality exceptions and closed-period adjustments

17.3 KPI Definitions
KPI Formula
Occupancy rate Occupied active units ÷ rentable active units × 100
Collection rate Payments allocated to period charges ÷ charges due for period × 100
Vacancy days Days between prior move-out/ready date and next lease start
Lead conversion Converted leads ÷ qualified leads × 100
Maintenance SLA compliance Requests met within SLA ÷ eligible requests × 100
Owner retention Owners retained at period end ÷ owners eligible for renewal × 100
Revenue per managed unit Company management revenue ÷ average managed units
Property NOI Property income − operating property expenses

17.3 Version 2 Specialized Reports and KPIs
• Brokerage pipeline, closed-deal commission, agent commission and one-time-deal profitability.
• Master lease vs. sublease revenue, occupancy, vacancy loss, shared-cost allocation and operating margin.
• Rentable-space utilization: parent area, leased child area, vacant child area and area monetization.
• Commercial rent per sqm and effective rent after incentives.
• Shared utility reconciliation: source bill, allocated amount, unallocated balance and allocation method.
• Land lease expiry, rent-review dates, escalation dates and notice deadlines. 18. Testing, Acceptance and Quality Assurance
18.1 Test Strategy
• Unit tests for domain calculations, permissions and state transitions.
• Integration tests for database transactions and external adapters.
• API contract tests for request, response and errors.
• End-to-end tests for critical journeys.
• Financial reconciliation and invariant tests.
• Security testing for authentication, authorization, uploads and common web vulnerabilities.
• Performance tests for search, dashboards, charge generation and reporting.
• Backup restore and disaster recovery exercises.
• User acceptance testing with leasing, finance, property and management representatives.
18.2 Critical End-to-End Scenarios 37. Onboard joint owners and activate a multi-unit property. 38. Convert an inquiry through viewing, application, reservation, lease and move-in. 39. Generate monthly charges and apply a partial payment across rent and service charge. 40. Reverse an incorrectly posted payment and verify ledger integrity. 41. Receive deposit, approve deductions and refund balance. 42. Process owner rent, management fee, property expense, statement and payout. 43. Resolve emergency maintenance with approval exception and subsequent review. 44. Renew lease with rent increase and preserve prior contract version. 45. Move tenant out, settle final balance and return unit to market. 46. Attempt prohibited cross-branch and cross-owner data access.
18.3 Acceptance Gates
• No critical security or financial-integrity defect open.
• All mandatory workflows pass UAT with approved evidence.
• Opening data migration reconciles to source totals.
• Payment, deposit and owner balances reconcile for test portfolios.
• Backup restore succeeds in a documented exercise.
• Roles and permissions are signed off by business owners.
• Training and operating procedures are available before go-live.
18.4 Version 2 Critical Acceptance Scenarios 47. Complete a brokerage-only deal and verify that the space becomes RENTED_EXTERNAL, disappears from availability and no monthly invoices or maintenance workflows are generated. 48. Run a full-management month and verify charges, partial payment allocation, maintenance expense, management fee, owner statement and owner payout calculation. 49. Create one master-leased floor with multiple child spaces, activate different subleases and verify profitability against master rent. 50. Allocate a shared generator bill equally, by area and by meter; verify totals, rounding and traceability. 51. Partition a commercial hall, lease one booth, then change the future layout without altering the historical lease record. 52. Create a land lease and verify residential fields are not required, maintenance is off by default and long-term expiry/rent-review alerts are scheduled. 19. Deployment, Operations and Disaster Recovery
19.1 Recommended Architecture
Layer Recommendation
Web applications Next.js/TypeScript portals with Tailwind and accessible component library
Backend NestJS modular monolith REST API
Database PostgreSQL with Prisma ORM and transactional migrations
Cache/queue Redis and BullMQ for jobs, schedules and integrations
File storage Cloudflare R2 or S3-compatible private storage with CDN for public listing media
Infrastructure Docker on Ubuntu VPS or managed container platform behind Nginx
Observability Central logs, metrics, uptime checks and error tracking
Delivery Git-based CI/CD with automated tests, migrations and rollback plan

19.2 Environments
• Local development
• Shared development/integration
• Staging/UAT using production-like configuration and anonymized data
• Production
• Optional disaster-recovery environment
19.3 Release Process
Controlled Release

1. Approve release scope and change record.
2. Run tests, lint, type checks, dependency and migration validation.
3. Build immutable application images.
4. Back up and verify recovery point.
5. Deploy to staging and run smoke/UAT checks.
6. Deploy production using rolling or brief controlled maintenance.
7. Run database migrations and health checks.
8. Monitor logs, queues and key transactions.
9. Rollback or remediate under documented criteria.
10. Close change record and publish release notes.
    19.4 Backup and Recovery
    Item Baseline
    Database Automated daily full backup plus point-in-time recovery where available
    Documents Versioned object storage and replication/backup policy
    Retention Daily/weekly/monthly tiers defined by business and legal requirements
    Restore testing Quarterly minimum for production readiness
    RPO Target ≤ 24 hours initially; lower with point-in-time recovery
    RTO Target ≤ 8 hours initially, refined by business impact analysis

19.5 Operating Procedures
• User provisioning and offboarding
• Payment verification and receipt correction
• Bank/mobile-money reconciliation
• Month-end close and owner payouts
• Maintenance emergency handling
• Security incident response
• Data correction and audit request
• Backup restore
• Integration outage fallback
• Release and rollback 20. Implementation Roadmap and Backlog
20.1 Delivery Workstreams
Phase Focus Key deliverables 0. Discovery and Control Validate local rules and operating procedures Policy decisions, chart of accounts, lease templates, data migration inventory, signed scope

1. Foundation Platform and governance Repo, environments, auth, RBAC, company/branch setup, audit, configuration
2. Portfolio Owners and property master data Owners, agreements, properties, buildings, units, documents, onboarding inspections
3. CRM and Leasing Revenue pipeline Listings, leads, activities, matching, viewings, applications, reservations, leases and move-in
4. Finance Core Rent and owner money Charges, invoices, payments, allocation, receipts, deposits, expenses, fees, statements and payouts
5. Operations Service delivery Maintenance, vendors, work orders, inspections, complaints, notices and tasks
6. Reporting and Portals Transparency and control Dashboards, reports, exports, owner portal and tenant portal
7. Financial Maturity Accounting and automation Full GL, reconciliation, period close, budgets, preventive maintenance and integrations
8. Optimization Scale and intelligence Mobile/offline, advanced BI, forecasting and selective AI assistance

20.2 MVP Epics
• Foundation and identity
• Company/branch administration
• Owner onboarding and agreements
• Property/building/unit registry
• Listing and CRM pipeline
• Viewing and application
• Lease and move-in
• Recurring charges and tenant ledger
• Payment, allocation and receipt
• Deposit management
• Expense and management fees
• Owner statement and payout
• Maintenance and vendors
• Inspection and move-out
• Notifications, reports and audit
• Data migration and go-live readiness
20.3 Definition of Done
• Requirement and acceptance criteria linked to implementation.
• Authorization, validation and audit behavior implemented.
• Automated tests pass at required level.
• Database migration reviewed and reversible where practical.
• User experience reviewed on desktop and mobile.
• Logging, monitoring and error handling included.
• Documentation and operating guidance updated.
• Business owner accepts feature in staging.
20.4 Recommended Implementation Sequence for Version 2 53. Foundation: identity, RBAC, company/branch, audit and approval framework. 54. Core property model: owner, property, rentable-space hierarchy, space lifecycle and documents. 55. Service model engine: feature eligibility and effective-dated engagement rules. 56. Brokerage MVP: CRM, listings, viewings, brokerage deal, commission and RENTED_EXTERNAL closure. 57. Full-management leasing: tenant, lease, recurring charges, payments, deposits and managed operations. 58. Owner accounting: fees, expenses, statements, payout controls and reconciliation. 59. Master lease/sublease: master obligations, child leases, shared utilities and profitability. 60. Commercial specialization: partitioning, sqm pricing and commercial contract templates. 61. Land specialization: simplified forms, long-term alerts and rent review. 62. Portals, advanced reports, notifications, integrations and optimization. 21. Risks, Decisions and Future Scope
21.1 Risk Register
Risk Impact Mitigation
Local legal rules not validated Invalid notices, contracts or deposit handling Use configurable rules and obtain local legal review before launch
Weak accounting design Owner disputes and incorrect reporting Approve chart of accounts, double-entry model and reconciliation before coding finance
Scope explosion Delayed unusable product Protect MVP and phase advanced features
Poor historical data Incorrect opening balances and duplicates Profile, clean, map and reconcile migration data
Overly broad permissions Fraud or privacy exposure Least privilege, scoped roles, SoD and access reviews
Manual payment fraud/error Incorrect receipts and balances Reference verification, duplicate checks, approvals and reconciliation
Informal off-system communication Missing history and disputes Centralize activity/communication logs and operating policy
Low staff adoption Shadow spreadsheets persist Involve users, optimize workflows, train and measure usage
Unreliable hosting/backups Business interruption/data loss Monitoring, tested backups and recovery plan
Owner/tenant portal leakage Privacy incident Object-level authorization and security testing

21.2 Required Business Decisions Before Build 63. Confirm fee schedules and commission rates for the approved business models: brokerage-only, full management, master lease/sublease, company-owned and rent-collection-only. 64. Whether commission is based on rent charged or rent collected. 65. Owner payout frequency, reserve and hold policies. 66. Deposit custody and refund policy. 67. Tenant screening criteria and approval authority. 68. Lease numbering, templates, notice periods and renewal rules. 69. Payment methods, verification evidence and receipt policy. 70. Expense and maintenance approval thresholds. 71. Branch and portfolio access model. 72. Accounting basis, chart of accounts and financial reporting requirements. 73. Data retention, privacy and document-access policies.
21.3 Future Enhancements
• Native mobile apps and offline field synchronization
• Integrated mobile-money confirmations and bank feeds
• Electronic signatures and identity verification
• Predictive vacancy and rent recommendations
• AI-assisted lead matching and maintenance categorization
• Energy and utility metering
• Investor/asset-management analytics
• Property sales module as a separate bounded product 22. Glossary, References and Traceability
22.1 Glossary
Term Definition
Owner Person or entity with a legal or contractual interest in a managed property.
Property The managed real-estate asset or site.
Building A physical structure within a property, usually containing units.
Unit The rentable space to which availability and a lease usually apply.
Lead A potential owner, tenant or other business opportunity not yet converted.
Applicant A prospect who submitted a rental application.
Tenant A party with an active or historical rental relationship.
Lease The rental contract and its operational record.
Charge An amount owed, such as rent, service fee, utility or damage.
Payment allocation The application of received money to one or more open charges.
Owner payable Verified funds currently due to an owner after deductions and holds.
Reserve Owner funds retained for approved property costs.
Security deposit Funds held against contractual obligations, not ordinary rent income.
Work order Authorized maintenance work assigned to staff or vendor.
Posting Finalizing a financial transaction into ledgers.
Reversal A controlled opposite transaction correcting a posted transaction.
Reconciliation Matching internal account records to an external bank or provider statement.
Rent roll Report of units, leases, recurring rent and occupancy.
NOI Net operating income: property income less operating property expenses.

22.2 Research and Professional References
Source Use in this blueprint URL
National Association of Residential Property Managers (NARPM) Code of Ethics and Standards of Professionalism: care of managed properties, handling of client funds, reporting and professional scope. https://www.narpm.org/code-of-ethics/
Buildium Unified property-management capabilities covering accounting, leasing, payments, maintenance, resident and owner portals, and reporting. https://www.buildium.com/features/
Buildium Owner Portal Owner access to financial reports, contributions, draws, transactions, documents and tasks. https://www.buildium.com/features/property-owner-portal/
AppFolio Property-management platform patterns for marketing/leasing, accounting/reporting, maintenance and owner experience. https://www.appfolio.com/
Yardi Voyager / RentCafe Integrated residential/commercial property management, accounting, maintenance and resident services. https://www.yardi.com/
OWASP Cheat Sheet Series Authentication, authorization, logging and secure file-upload implementation guidance. https://cheatsheetseries.owasp.org/

References are used as industry-pattern inputs, not as jurisdiction-specific legal or accounting advice. Product names belong to their respective owners.
22.3 Requirements Traceability Approach
Artifact Trace link
Business requirement BR-xxx
Product epic EPIC-xxx mapped to BR IDs
Functional requirement/user story FR/US mapped to epic and BR
API/database implementation Endpoint/entity mapped to FR/US
Test case TC mapped to acceptance criterion and requirement
Release evidence Deployment/change record mapped to tested stories

22.4 Final Approval Checklist
• Business scope approved
• Local legal review planned/completed
• Accounting model and chart approved
• Roles and segregation approved
• Core workflows approved
• Data model reviewed
• Security baseline approved
• MVP roadmap funded and staffed
• Migration sources inventoried
• UAT owners identified
 
22.5 Version 2 Domain Glossary Additions
Term Definition
Service Model The commercial/operating relationship that determines which workflows and accounting rules apply.
Rentable Space Any independently leasable physical space such as a unit, room, floor, hall, shop, booth or land parcel.
Parent Space A rentable space that contains or is subdivided into child rentable spaces.
Brokerage Deal A one-time transaction in which the company earns commission but does not manage recurring rent.
RENTED_EXTERNAL Status indicating the space was successfully rented through the company but is not under ongoing company management.
Master Lease Lease under which the company rents a parent space from the owner.
Sublease Lease from the company to a tenant for all or part of a master-leased space.
Shared Utility Allocation Distribution of one common utility cost to multiple rentable spaces using an approved rule.
Area-Based Pricing Rent calculated from rentable area multiplied by a rate per square metre or other configured area unit.
Space Partition Controlled subdivision of a parent space into smaller leasable spaces while preserving history.
22.6 Business Model Rules at a Glance
Rule Brokerage Full Management Master Lease/Sublease Land
Primary earning Commission Management/service fees Rental spread/margin Configured lease income
Recurring billing No Yes Yes As configured
Ongoing maintenance No Yes Yes Off by default
Owner payout No Yes Normally no Arrangement-dependent
Key status after occupancy RENTED_EXTERNAL OCCUPIED SUBLEASED / OCCUPIED LEASED
Special data Deal + commission Owner/tenant/operations Master + child spaces + utilities Area + use + long-term dates
Appendix A — Sample Numbering Standards
Record Example
Owner OWN-000123
Property PRP-MOG-00045
Unit UNT-PRP00045-A-03
Lead LED-2026-001234
Application APP-2026-000456
Lease LSE-2026-000789
Invoice INV-2026-001001
Receipt RCT-MOG-2026-001555
Maintenance MNT-2026-000321
Owner payout PAY-OWN-2026-00077

Appendix B — Sample Data-Quality Exceptions
• Available unit without approved rent or required listing media
• Occupied unit without active lease
• Active lease without signed document
• Posted payment with no allocation beyond configured age
• Owner payout pending beyond schedule
• Deposit liability not tied to active/historical lease
• Maintenance emergency without acknowledgement
• Expense without responsibility or property/category
• Management fee without active agreement
• Expired owner or property document
Appendix C — Go-Live Readiness Checklist
• Production infrastructure and monitoring ready
• Backups and restore tested
• Company/branch settings configured
• Users, roles and approval limits verified
• Owners, properties, units and opening balances migrated/reconciled
• Lease and notice templates approved
• Payment methods and accounts configured
• Notification providers tested
• Critical reports validated
• Support contacts and escalation published
• Staff training completed
• Parallel run or cutover signed off
