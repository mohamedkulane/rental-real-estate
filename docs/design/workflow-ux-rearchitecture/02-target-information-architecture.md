# Target information architecture

## Principle

Employees start with a business task. Canonical registers remain for advanced inspection, correction, reporting, and administration. UX orchestration coordinates existing domains; it never collapses or duplicates them.

```text
Global shell
├── Dashboard
├── + Start New
│   ├── Onboard Property
│   ├── Start Rental Brokerage
│   ├── Start Full Management
│   ├── Prepare Property Sale
│   └── Add Lead
├── Incomplete Work
├── CRM
├── Portfolio
│   ├── Overview
│   └── Advanced Records
│       ├── Parties
│       ├── Owners
│       ├── Properties
│       ├── Rentable Spaces
│       └── Amenities
├── Rental Brokerage
├── Full Management
├── Property Sales
├── Commercial / Service Authorities (advanced)
├── Administration
└── Oversight
```

Finance, Operations, Reporting, Construction, and Development appear only when their governing phases pass. They are not dead links or simulated modules.

## `+ Start New`

The launcher is a dialog on desktop and a viewport-fitting sheet on mobile. It presents only actions satisfying all four conditions:

1. the underlying phase is implemented and passed;
2. the principal has every required permission;
3. an authorized branch/resource scope is available;
4. server capability policy permits the action where relevant.

The action count is small, so launcher search is not needed. Dismissal restores focus to the trigger.

| Action | Design | Current enablement |
| --- | --- | --- |
| Onboard Property | Complete | Wait for workflow/orchestration contract |
| Rental Brokerage setup | Complete | May end only at asset + Service Engagement + supported Documents |
| Full Management setup | Complete | No leases, rent, maintenance, finance, payouts |
| Property Sale setup | Complete | No listing, offer, deal, settlement, commission |
| Add Lead | Complete | Wait for durable Phase 5.2 API/UI |
| Construction Project | Boundary only | Omit; CRM intake only |
| Development Project | Boundary only | Omit |

## Workspace rules

- Guided creation/setup uses a stepper and durable draft.
- Daily work uses complete server-backed workspaces.
- CRM contextual views filter the one canonical Lead.
- Advanced registers retain server search/filters, stable cursor pagination, branch/company authorization, accurate totals, and all data states.
- No current-page-only search, load-all, `limit=100`, or per-row detail-fetch loop.
- Default global navigation stays at two levels; detail tabs remain contextual.
- Building, Ownership, Documents, and Branch Assignments remain contextual Property/Owner/Space workspaces. They are not promoted to peer global registers unless a later evidence-backed task requires it.

## Visual-system decision

The new specification requests blue as primary while the approved design-system document currently defines emerald as primary action and blue as informational. This pack does not silently override the approved system. Wave 0 must formally version the token decision. Until then, implementation follows approved tokens and avoids new scattered hard-coded colors.
