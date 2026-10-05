# Whole-property service authority repair

## Decision

Historical `FULL_MANAGEMENT` and `RENTAL_BROKERAGE` engagements are not converted merely because they reference a unit. Unit-scoped authority remains a valid business choice.

The repair script changes an engagement to property scope only when its own notes contain an exact marker written by one of the former whole-property onboarding flows:

- `Created from full management onboarding.`
- `Created from rental brokerage onboarding.`
- JSON source `simplified-full-management`
- JSON source `simplified-rental-brokerage`

These flows did not let the operator choose a unit and historically assigned the first unit internally, so the marker is sufficient proof. An activated service engagement is immutable and is never overwritten. The repair deactivates the proven old record at the repair date, preserves its historical scope, and creates an active property-scoped replacement with cloned commercial terms. It writes lifecycle history and an audit record. The script is dry-run by default and idempotent because it only considers active unit-scoped records and tags the replacement with its source engagement.

## Operation

```powershell
pnpm exec tsx scripts/repair-whole-property-authority.ts
pnpm exec tsx scripts/repair-whole-property-authority.ts --apply
```

Review the dry-run record list before applying it in any environment.
