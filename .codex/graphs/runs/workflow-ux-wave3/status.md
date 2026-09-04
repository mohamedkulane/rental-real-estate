# Workflow UX Rearchitecture — Wave 3

- Base checkpoint: `b419d29` (Wave 2 PASS)
- Scope audited: guided Property Onboarding
- Result: BLOCKED

## Confirmed blocker

The current repository exposes separate canonical CRUD/read models for Party,
Owner, Property, Building, RentableSpace, ServiceEngagement, and Documents,
but no approved orchestration boundary for the eight-step onboarding flow. It
also has no durable, version-safe, audited workflow draft/resume envelope or
coordinated completion command.

Implementing Wave 3 with browser-local state, a giant JSON replacement model,
or client-side multi-request sequencing would violate the approved design and
architecture protections. Wave 3 therefore cannot pass until the governed
workflow/orchestration and draft contracts are approved and implemented.

Phase 5.3, Wave 4+, and any future business-domain models remain NOT STARTED.
