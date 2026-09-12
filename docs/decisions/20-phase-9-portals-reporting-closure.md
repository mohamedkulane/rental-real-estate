# Phase 9 Portals, Reporting & Production Readiness Closure

## Gate

Phase 9 portals, reporting, and production readiness closure.

## Scope delivered
- Owner portal with relationship-scoped portfolio, statements, payouts, maintenance, and activity
- Tenant portal with lease, invoices, payments, receipts, maintenance requests, and profile
- Portal authorization with company isolation and resource-level checks (no staff permission leakage)
- Reporting workspace with portfolio, CRM, rental, full management, sales, operations, finance, and branch sections
- Aggregated dashboard read model API
- Global search with permission and branch scope
- Internal notification foundation with deduplication and source links
- CSV report export with branch and permission scope
- Performance indexes for party/property search and notification inbox
- Production readiness review for env validation, health endpoints, and startup behavior

## Verification

PHASE 9 PORTALS REPORTING CLOSURE: PASS
OWNER PORTAL: PASS
TENANT PORTAL: PASS
REPORTING WORKSPACE: PASS
DASHBOARD READ MODELS: PASS
GLOBAL SEARCH: PASS
NOTIFICATIONS: PASS
AUTOMATED QA: PASS
UI/UX REVIEW: PASS
UNRESOLVED CRITICAL: 0
UNRESOLVED HIGH: 0
PHASE 10 STARTED: NO

## Browser scenarios

- Scenario A Owner login → owned portfolio → statement/payout/maintenance
- Scenario B Tenant login → lease → invoices → maintenance request
- Scenario C Manager dashboard → reports → branch filters
- Scenario D Global search → authorized record navigation
- Scenario E Notification → source record navigation
- Scenario F Finance report → filtered CSV export
- Scenario G Cross-branch authorization
- Scenario H Portal resource isolation

## Security review

- Portal sessions resolve through dedicated PortalAccount binding, not employee roles
- Owner/tenant record access validated server-side on every portal endpoint
- Staff global search and reports enforce permission + branch scope
- No IDOR paths identified in portal statement/payout/property access during review

## Known non-blocking follow-ups

- PDF export deferred until dedicated document tooling is approved
- External SMS/email notification adapters remain future work
