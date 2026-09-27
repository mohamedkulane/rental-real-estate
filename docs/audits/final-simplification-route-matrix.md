# Final Simplification Route Matrix

Date: 2026-09-27  
Branch: `master`  
Baseline HEAD: `5b6bbfd`  
Route count: 103

## Classification Rules

- `PRIMARY`: a normal staff destination in the approved information architecture.
- `CONTEXTUAL`: a detail or focused action reached from a primary workspace.
- `LEGACY_REDIRECT`: a compatibility URL that immediately sends users to the canonical route.
- `INTERNAL_ADVANCED`: retained for compatibility, administration, portals, or technical workflows, but hidden from normal staff navigation.
- `REMOVE_DEV_ONLY`: unavailable in the production product surface.

## Route Matrix

| Route | Current purpose | Target | Classification | Reason |
| --- | --- | --- | --- | --- |
| `/` | Root redirect to login | `/login` | LEGACY_REDIRECT | Preserve the existing authenticated entry behavior. |
| `/login` | Staff sign-in | Keep | CONTEXTUAL | Required entry surface, not a business navigation item. |
| `/admin` | Branch, employee, role, and settings console | Keep | PRIMARY | Canonical Administration workspace. |
| `/commercial/full-management` | Full Management operations dashboard | Keep | PRIMARY | Canonical Rental > Full Management workspace. |
| `/commercial/offers` | Generic sale offer register | `/sales/deals` | INTERNAL_ADVANCED | Sale offers remain implementation detail of Sales. |
| `/commercial/offers/new` | Generic sale offer create page | Sales deal contextual action | INTERNAL_ADVANCED | Staff should create offers inside the Sales journey. |
| `/commercial/offers/[id]` | Generic sale offer detail | Sales deal detail | INTERNAL_ADVANCED | Detail remains compatible but should not interrupt Sales flow. |
| `/commercial/property-sales` | Older property sales dashboard | `/sales` | LEGACY_REDIRECT | Sales overview is canonical. |
| `/commercial/property-sales/pipeline` | Older sales pipeline | `/sales/deals` | LEGACY_REDIRECT | Sales Deals owns the pipeline. |
| `/commercial/rental-brokerage` | Brokerage properties and placements | Keep | PRIMARY | Canonical Rental > Brokerage workspace. |
| `/commercial/rental-brokerage/deals` | Separate brokerage deal register | `/commercial/rental-brokerage` | LEGACY_REDIRECT | Brokerage properties and deals belong in one workspace. |
| `/commercial/rental-brokerage/new` | Manual brokerage deal entry | `/commercial/rental-brokerage` | LEGACY_REDIRECT | Deals are created from confirmed agreements. |
| `/commercial/rental-brokerage/[id]` | Brokerage placement detail and commission collection | Keep | CONTEXTUAL | Contextual placement lifecycle and collection surface. |
| `/commercial/service-engagements` | Service engagement register | `/commercial/rental-brokerage` | LEGACY_REDIRECT | Internal authority is not a normal staff register. |
| `/commercial/service-engagements/[engagementId]` | Service authority detail | Keep hidden | INTERNAL_ADVANCED | Needed for audit/support compatibility only. |
| `/commercial/settlements` | Generic sale settlement register | `/sales/deals` | LEGACY_REDIRECT | Settlement belongs inside Sales Deal detail. |
| `/commercial/settlements/new` | Generic settlement create page | Sales deal contextual action | INTERNAL_ADVANCED | Staff should settle from the owning deal. |
| `/commercial/settlements/[id]` | Generic settlement detail | Sales deal detail | INTERNAL_ADVANCED | Preserve records without exposing a second journey. |
| `/construction` | Construction projects workspace | Keep | PRIMARY | Canonical Projects > Construction workspace. |
| `/construction/projects/[id]` | Construction project detail | Keep | CONTEXTUAL | Context reached from Construction. |
| `/crm` | Generic CRM entry | `/rental/customers` | LEGACY_REDIRECT | Rent and Buy journeys own their customers. |
| `/crm/follow-ups` | Generic CRM follow-up queue | Hide | INTERNAL_ADVANCED | Follow-ups should surface in business context. |
| `/crm/lead-sources` | Lead source administration | Administration | INTERNAL_ADVANCED | Configuration, not a staff business workspace. |
| `/crm/leads` | Generic lead register | Rental Customers or Sales Buyers | LEGACY_REDIRECT | Route by customer intent to canonical workspaces. |
| `/crm/leads/new` | Generic lead create | Rental Customer or Sales Buyer drawer | LEGACY_REDIRECT | Creation belongs in the selected business journey. |
| `/crm/leads/[leadId]` | Generic lead detail | Rental Customer or Sales Buyer detail | INTERNAL_ADVANCED | Retain compatibility while normal links stay business-facing. |
| `/crm/leads/[leadId]/edit` | Generic lead editor | Business-facing customer edit drawer | INTERNAL_ADVANCED | Normal staff must not be sent into generic CRM. |
| `/crm/pipeline` | Generic CRM pipeline | `/sales/deals` | LEGACY_REDIRECT | Business pipelines are owned by Rental or Sales. |
| `/crm/viewings` | Older CRM viewing route | `/viewings` | LEGACY_REDIRECT | Operations > Viewings is canonical. |
| `/dev/toasts` | Toast component preview | Not found in production | REMOVE_DEV_ONLY | Development-only UI must not be in production surface. |
| `/development` | Development projects workspace | Keep | PRIMARY | Canonical Projects > Development workspace. |
| `/development/projects/[id]` | Development project detail | Keep | CONTEXTUAL | Context reached from Development. |
| `/finance` | Accounting-oriented finance dashboard | Simplified business finance overview | PRIMARY | Must answer cash, earnings, owner liability, and attention questions. |
| `/finance/accounting` | Journal register | Hide | INTERNAL_ADVANCED | Journals remain backend/accounting plumbing. |
| `/finance/accounting/new` | Manual journal create | Hide | INTERNAL_ADVANCED | Restricted advanced accounting action. |
| `/finance/accounting/[id]` | Journal detail | Keep hidden | INTERNAL_ADVANCED | Required for audit/history, not normal navigation. |
| `/finance/billing-schedules` | Billing schedule operations | Hide | INTERNAL_ADVANCED | Full Management should generate billing contextually. |
| `/finance/charges` | Charge register | Hide | INTERNAL_ADVANCED | Receivables remain internal finance primitives. |
| `/finance/expenses` | Expense register | Keep | PRIMARY | Canonical Finance > Expenses workspace. |
| `/finance/expenses/new` | Add expense page | Expense drawer/action | CONTEXTUAL | Focused action from Expenses or managed property. |
| `/finance/expenses/[id]` | Expense detail | Keep | CONTEXTUAL | History and approval detail. |
| `/finance/invoices` | Invoice register | Hide | INTERNAL_ADVANCED | Invoices are not the normal staff entry point. |
| `/finance/invoices/new` | Manual invoice create | Hide | INTERNAL_ADVANCED | Billing should be workflow-driven. |
| `/finance/invoices/[id]` | Invoice detail | Keep hidden | INTERNAL_ADVANCED | Historical compatibility only. |
| `/finance/owner-payouts` | Owner payout register | Keep | PRIMARY | Canonical Finance > Owner Payouts workspace. |
| `/finance/owner-payouts/new` | Owner payout create | Payout contextual action | CONTEXTUAL | Review and approval remain contextual. |
| `/finance/owner-payouts/[id]` | Owner payout detail | Keep | CONTEXTUAL | Approval and audit history. |
| `/finance/owner-statements` | Owner statement register | Keep | PRIMARY | Canonical Finance > Owner Statements workspace. |
| `/finance/owner-statements/[id]` | Owner statement detail | Keep | CONTEXTUAL | Statement review and history. |
| `/finance/payments` | Payment register and fallback record payment | Keep | PRIMARY | Canonical Finance > Payments workspace. |
| `/finance/payments/new` | Older payment creation URL | `/finance/payments?create=1` | LEGACY_REDIRECT | Preserve bookmark while using the drawer. |
| `/finance/payments/[id]` | Payment detail | Keep | CONTEXTUAL | Verification and immutable payment history. |
| `/leasing/applications` | Application register | `/rental/customers` | LEGACY_REDIRECT | Applications remain compatibility data only. |
| `/leasing/leases` | Lease register | Keep | PRIMARY | Canonical Rental > Leases workspace. |
| `/leasing/leases/[id]` | Lease detail, move-in/out, renewal, rent | Keep | CONTEXTUAL | Owns the tenancy lifecycle. |
| `/leasing/move-ins` | Move-in register | `/leasing/leases` | LEGACY_REDIRECT | Move-In is a Lease Detail action. |
| `/leasing/renewals` | Renewal register | `/leasing/leases` | LEGACY_REDIRECT | Renewal is a Lease Detail action. |
| `/leasing/reservations` | Reservation register | `/rental/customers` | LEGACY_REDIRECT | Reservations remain internal compatibility. |
| `/leasing/tenants` | Tenant register | `/rental/customers` | LEGACY_REDIRECT | Current tenants are reached through customers and leases. |
| `/marketing/rental-listings` | Older rental listing register | `/rental/properties` | LEGACY_REDIRECT | Rental Properties is canonical. |
| `/marketing/sale-listings` | Older sale listing register | `/sales/properties` | LEGACY_REDIRECT | Properties for Sale is canonical. |
| `/operations` | Operations overview | Keep | PRIMARY | Canonical Operations overview. |
| `/operations/inspections` | Inspection register | Keep | PRIMARY | Canonical Operations > Inspections workspace. |
| `/operations/inspections/[id]` | Inspection detail | Keep | CONTEXTUAL | Context reached from Inspections. |
| `/operations/maintenance` | Maintenance register | Keep | PRIMARY | Canonical Operations > Maintenance workspace. |
| `/operations/maintenance/[id]` | Maintenance detail | Keep | CONTEXTUAL | Context reached from Maintenance. |
| `/operations/vendors` | Vendor register | Hide from primary nav | INTERNAL_ADVANCED | Supporting Operations data, not a top-level task. |
| `/operations/vendors/[id]` | Vendor detail | Keep hidden | INTERNAL_ADVANCED | Contextual support record. |
| `/operations/work-orders` | Work-order register | Hide from primary nav | INTERNAL_ADVANCED | Maintenance workspace should own normal work orders. |
| `/operations/work-orders/[id]` | Work-order detail | Keep hidden | INTERNAL_ADVANCED | Contextual support record. |
| `/portal/owner` | Owner self-service portal | Keep separately scoped | INTERNAL_ADVANCED | External-role surface, not staff navigation. |
| `/portal/owner/statements/[id]` | Owner portal statement detail | Keep separately scoped | INTERNAL_ADVANCED | External-role context. |
| `/portal/tenant` | Tenant self-service portal | Keep separately scoped | INTERNAL_ADVANCED | External-role surface, not staff navigation. |
| `/portfolio` | Owners and Amenities console | Keep | PRIMARY | Canonical Portfolio workspaces selected by section. |
| `/portfolio/buildings/[buildingId]` | Building detail | Keep | CONTEXTUAL | Advanced property context. |
| `/portfolio/properties` | Older property register URL | `/rental/properties` | LEGACY_REDIRECT | One canonical Properties register. |
| `/portfolio/properties/[propertyId]` | Property detail | Keep | CONTEXTUAL | Canonical property detail. |
| `/portfolio/rentable-spaces/[spaceId]` | Rentable-space detail | Keep | CONTEXTUAL | Advanced unit context. |
| `/rental` | Rental overview | Keep | PRIMARY | Canonical Rental overview. |
| `/rental/brokerage/new` | Older brokerage start URL | Brokerage create drawer | LEGACY_REDIRECT | Preserve bookmark without separate page. |
| `/rental/customers` | Rental customer register | Keep | PRIMARY | Canonical Rental > Customers workspace. |
| `/rental/customers/new` | Older customer create URL | Customer drawer | LEGACY_REDIRECT | Preserve bookmark without separate page. |
| `/rental/customers/[leadId]` | Rental customer requirements, matches, viewings, progress, history | Keep | CONTEXTUAL | Owns the rental customer journey. |
| `/rental/full-management/new` | Older management start URL | Full Management create drawer | LEGACY_REDIRECT | Preserve bookmark without separate page. |
| `/rental/leases/new` | Direct lease creation page | Confirmed Agreement action | INTERNAL_ADVANCED | No normal pre-agreement Create Lease path. |
| `/rental/owners/new` | Older owner create URL | Owner drawer | LEGACY_REDIRECT | Preserve bookmark without separate page. |
| `/rental/properties` | Property register | Keep | PRIMARY | Canonical Portfolio > Properties workspace. |
| `/rental/properties/new` | Older property create URL | Property drawer | LEGACY_REDIRECT | Preserve bookmark without separate page. |
| `/rental/properties/[propertyId]` | Older rental property detail URL | `/portfolio/properties/[propertyId]` | LEGACY_REDIRECT | One canonical Property Detail. |
| `/rental/viewings` | Older rental viewing URL | `/viewings` | LEGACY_REDIRECT | Operations > Viewings is canonical. |
| `/reports` | Business reporting workspace | Keep | PRIMARY | Canonical Reporting > Reports workspace. |
| `/sales` | Sales overview | Keep | PRIMARY | Canonical Sales overview. |
| `/sales/buyers` | Buyer register | Keep | PRIMARY | Canonical Sales > Buyers workspace. |
| `/sales/buyers/new` | Older buyer create URL | Buyer drawer | LEGACY_REDIRECT | Preserve bookmark without separate page. |
| `/sales/buyers/[leadId]` | Buyer requirements, matches, viewings, and progress | Keep | CONTEXTUAL | Owns buyer journey. |
| `/sales/deals` | Sales deal register | Keep | PRIMARY | Canonical Sales > Deals workspace. |
| `/sales/deals/new` | Agreement/deal action surface | Sales customer/deal context | CONTEXTUAL | Supports the canonical Sales lifecycle. |
| `/sales/properties` | Properties for sale register | Keep | PRIMARY | Canonical Sales > Properties for Sale workspace. |
| `/settings` | Older settings URL | `/admin?section=settings` | LEGACY_REDIRECT | Administration owns settings. |
| `/viewings` | Unified rental and sales viewing operations | Keep | PRIMARY | Canonical Operations > Viewings workspace. |
| `/workflows` | Incomplete onboarding workflows | Hide from normal navigation | INTERNAL_ADVANCED | Draft recovery/support surface. |
| `/workflows/new` | Guided workflow start | Contextual create drawers | INTERNAL_ADVANCED | Do not expose a second onboarding architecture. |
| `/workflows/[workflowId]` | Guided workflow editor | Keep hidden | INTERNAL_ADVANCED | Draft recovery and compatibility only. |

## Approved Primary Navigation

- Portfolio: Owners, Properties, Amenities
- Rental: Overview, Customers, Brokerage, Full Management, Leases
- Sales: Overview, Buyers, Properties for Sale, Deals
- Operations: Overview, Viewings, Maintenance, Inspections
- Projects: Construction, Development
- Finance: Overview, Payments, Expenses, Owner Statements, Owner Payouts
- Reporting: Reports
- Administration: Branches, Employees, Roles & Permissions, Settings

## Checkpoint A Exit Criteria

- Sidebar exactly matches the approved primary navigation.
- Every one of the 103 Next.js page routes has a classification.
- Duplicate registers remain available only as redirects or hidden compatibility routes.
- No database-oriented finance route appears in normal navigation.
- No generic CRM or Service Engagement group appears in normal navigation.
