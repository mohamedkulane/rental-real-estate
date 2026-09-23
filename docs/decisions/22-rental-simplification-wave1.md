# Rental simplification wave 1 — task-first UX

Date: 2026-09-17

## Context

Rental staff were exposed to canonical domain entities (Party, Ownership, RentableSpace, ServiceEngagement, workflow wizards) in the primary navigation. That slowed common tasks and increased training cost without changing underlying business rules.

## Decision

Keep all canonical backend models and authorization rules unchanged. Add a **rental orchestration command layer** (`/api/v1/rental/commands/*`) that composes existing services (Party, Portfolio, CRM Lead, ServiceEngagement) in short transactional sequences.

Expose a simplified **Rental** workspace in the web app:

| Sidebar item | Route | Task |
|--------------|-------|------|
| Overview | `/rental` | Quick actions |
| Rental Customers | `/rental/customers` | RENT leads without phone/email requirement |
| Properties | `/rental/properties` | Property + ownership + rentable space + activation |
| Brokerage | `/commercial/rental-brokerage` | Existing dashboard; start via `/rental/brokerage/new` |
| Full Management | `/commercial/full-management` | Existing dashboard; start via `/rental/full-management/new` |
| Leases | `/leasing/leases` | Unchanged |
| Payments | `/finance/payments` | Unchanged |

Removed from the **primary Rental sidebar** because they are not independent daily tasks. See `docs/decisions/23-frontend-page-inventory.md` for KEEP / MERGE / CONTEXTUALIZE / REMOVE:

- Applications, Reservations, Tenants, Renewals, Move-In, Viewings
- Service Engagements register, Party register, Rentable Spaces register
- Generic Lead Register and rental-intent CRM leads
- Marketing rental listings

Frontend routes for those pages now redirect to the primary workspace. Canonical backend models stay.

## Assumptions recorded

1. **Rental customer contact**: Simplified create accepts name + preferences only. Phone/email can be added later on the CRM lead detail page. Audit action: `rental.customer.created`.
2. **Property onboarding**: Single form creates property, 100% ownership, one or more rentable spaces, and activates property to `ACTIVE` (presented as **Available** in rental UI).
3. **Commercial terms**: `ServiceEngagementCommercialTerms` are written by orchestration immediately after engagement create, before activation.
4. **Brokerage / Full Management start**: Owner and property are selected explicitly; primary active rentable space is resolved automatically when omitted.
5. **Phase 2 deferrals**: Matching UI on customer detail, lease contextual tabs, rental status automation from lease events, finance simplification for rental-only roles, **RentalListing creation from captured monthly rent** (rent is collected in simplified forms but persisted on listings/leases per canonical model).

## Non-goals (this wave)

- No backend domain model changes
- No weakening of branch authorization or financial immutability rules
- No removal of workflow engine or canonical registers
