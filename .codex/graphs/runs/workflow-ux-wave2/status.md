# Workflow UX Rearchitecture — Wave 2

- Base checkpoint: `a4bced2` (Wave 1 PASS)
- Scope: global permission-aware `Start New` launcher
- Valid current action: `Add Lead` → `/crm/leads/new`
- Intentionally omitted until governed backend workflows exist: Property onboarding, Rental Brokerage, Full Management, Property Sale, Construction, Development, Listings/Matching, Finance, Settlement, Maintenance.

The launcher is implemented in the shared shell with keyboard focus trap,
Escape handling, focus restoration, responsive dialog sizing, and permission
gating. No unavailable or future-phase action is rendered.
