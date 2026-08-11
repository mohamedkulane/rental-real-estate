# Scope

## Included

- Person and organization Parties with typed profiles, encrypted contact values, normalized contact hashes, and structured addresses.
- Owner profiles, status, communication preference, protected notes, and owner portfolio reads.
- Effective-dated Property ownership and independently effective-dated payout entitlement.
- Property, optional Building, physical property classification, location, measurements, status, and operating-branch history.
- RentableSpace stable identity, reference types, optional Building, effective measurements, recursive parent history, physical profiles, and retirement.
- Atomic commercial partitioning and effective-dated measurement/reparenting operations.
- Land specialization without residential fields.
- Normalized property/space amenities and object-storage document metadata boundaries.
- Phase 4 permissions, branch-scoped backend authorization, validation, transactions, audit evidence, migrations, seed data, UI, and tests.

## Excluded

ServiceEngagement, CRM, listings, leads, viewings, applications, reservations, tenant leasing profiles, leases, brokerage, charges, payments, accounting, deposits, maintenance, owner statements, and payouts remain deferred.

## Governing semantics

- Parties and Owners belong to the company; Properties have an effective operating branch.
- Property type is physical classification and is independent of future service model.
- RentableSpace—not Property or Building—is the future reservable/leasable/brokerable target.
- Effective intervals use `[effectiveFrom, effectiveTo)`.
- Draft Properties may be incomplete. Active Properties require one operating branch and exactly 100% active ownership and payout entitlement from active Owners.
- Historical ownership, branch, hierarchy, measurement, document, and audit evidence is preserved.
