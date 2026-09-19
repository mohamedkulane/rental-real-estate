# Frontend page inventory — task-first cleanup

Date: 2026-09-18

Canonical backend models stay. This inventory classifies **frontend pages** only.

| Current route | Classification | Destination | Justification |
|---|---|---|---|
| `/login` | KEEP | — | Authentication. |
| `/` | KEEP | — | Dashboard / home. |
| `/admin` | KEEP | — | Company, branches, employees, users, roles. Unique admin tasks. |
| `/rental` | KEEP | — | Rental task launcher. |
| `/rental/customers` | KEEP | — | Register someone looking for a rental and match properties. |
| `/rental/customers/new` | KEEP | — | Minimal rental-customer create. |
| `/rental/customers/[leadId]` | KEEP | — | Customer matching, viewing, lease start. |
| `/rental/owners/new` | KEEP | — | Add owner without Party workspace. |
| `/rental/properties` | KEEP | — | Rental property register with Available / Rented / Unavailable. |
| `/rental/properties/new` | KEEP | — | Add property + ownership + unit + rent. |
| `/rental/properties/[propertyId]` | KEEP | — | Property status, rent, units, lease start. |
| `/rental/brokerage/new` | KEEP | — | Start brokerage with commission. |
| `/rental/full-management/new` | KEEP | — | Start full management with fee. |
| `/rental/leases/new` | KEEP | — | Create a lease from customer + property. Application/tenant/landlord resolved internally. |
| `/leasing/leases` | KEEP | — | Recurring lease register (status, payments, renewal). |
| `/leasing/leases/[id]` | KEEP | — | Lease detail with Renewal, Move-In, Documents, Activity tabs. |
| `/commercial/rental-brokerage` | KEEP | — | Brokerage deals and commissions. |
| `/commercial/full-management` | KEEP | — | Managed-property authority. |
| `/finance` and finance registers | KEEP | — | Distinct financial tasks (invoices, payments, statements, payouts, expenses, accounting). |
| `/commercial/property-sales` | KEEP | — | Sale authority / pipeline. |
| `/commercial/property-sales/pipeline` | KEEP | — | Sales pipeline. |
| `/commercial/offers` | KEEP | — | Sale offers. |
| `/commercial/settlements` | KEEP | — | Sale settlements. |
| `/marketing/sale-listings` | KEEP | — | Sale marketing register. |
| `/crm/leads?intent=BUY` | KEEP | — | Buyer journey is not the rental customer workspace. |
| `/crm/leads?intent=SELL` | KEEP | — | Seller journey. |
| `/crm/pipeline` | KEEP | — | Sales/construction pipeline board. |
| `/crm/follow-ups` | KEEP | — | Recurring follow-up work. |
| `/crm/lead-sources` | KEEP | — | Admin catalog. |
| `/construction`, `/development` | KEEP | — | Distinct project operations. |
| `/operations/*` | KEEP | — | Maintenance, work orders, inspections, vendors. |
| `/workflows` | KEEP | — | Incomplete guided work. |
| `/reports` | KEEP | — | Reporting. |
| `/portal/tenant`, `/portal/owner` | KEEP | — | External portals. |
| `/leasing/applications` | REMOVE | `/rental/customers` and lease create | Staff do not hunt approved applications. Orchestration creates/approves them. |
| `/leasing/reservations` | CONTEXTUALIZE | Customer / property / lease | Hold-space is not a primary daily register. |
| `/leasing/tenants` | MERGE | `/rental/customers` + lease | Tenant profile is created when a lease is created. |
| `/leasing/renewals` | CONTEXTUALIZE | `/leasing/leases/[id]` Renewal tab | Renewal is a lease action. |
| `/leasing/move-ins` | CONTEXTUALIZE | `/leasing/leases/[id]` Move-In tab | Move-in is a lease action. |
| `/crm/viewings` | CONTEXTUALIZE | `/rental/customers/[id]` | Viewing is scheduled from a matched property. |
| `/marketing/rental-listings` | MERGE | `/rental/properties` | Listings are created when brokerage/FM starts. |
| `/commercial/service-engagements` | REMOVE | Brokerage / Full Management / Sales | Engagement is created by those tasks. |
| `/commercial/service-engagements/[id]` | CONTEXTUALIZE | Brokerage / Full Management / Sales detail link | Agreement detail is opened from the service workspace, not a register. |
| `/portfolio?section=parties` | REMOVE | Owner / customer create | Party is resolved internally. |
| `/portfolio?section=spaces` | CONTEXTUALIZE | Property detail Spaces tab | Units are managed on the property. Standalone register is not a sidebar task. |
| `/portfolio?section=owners` | KEEP | — | Owner register still needed to find owners. |
| `/portfolio?section=properties` | MERGE | `/rental/properties` for rental staff | Advanced portfolio property list remains for ownership/documents. |
| `/portfolio/properties/[id]` | KEEP | — | Advanced property workspace (ownership, spaces, documents). |
| `/portfolio/rentable-spaces/[id]` | CONTEXTUALIZE | Opened from property spaces | Not a sidebar register. |
| `/crm/leads` (generic / RENT) | MERGE | `/rental/customers` | Rental customers have a purpose-built workspace. |
| `/crm/leads/new` without intent | MERGE | `/rental/customers/new` | Default create is rental customer. |
| `/crm/leads/[leadId]` | KEEP | Buyer/seller detail; rental uses `/rental/customers/[id]` | Buyer and seller still need a CRM case file. |
| `/workflows/new?type=PROPERTY_ONBOARDING` | KEEP | Advanced only | Labeled Advanced Property Onboarding. Not the primary Add Property. |

## Lease creation rule

The lease **database** still requires an approved application, tenant profile, and landlord party.

The **user** selects: rental customer, property, rent, start date, end date.

Orchestration creates/submits/waives screening/approves the application, converts the tenant, resolves the landlord from current ownership, and creates the lease.
