# Active residential tenancy invariant

## Decision

A Party acting as a residential tenant may have at most one Lease in `ACTIVE`
status at a time. Draft, signed-but-not-active, ended, terminated, and archived
leases do not consume the active-tenancy slot. Viewings, opportunities,
applications, and agreements are unaffected.

The same Party identity is reused when a former tenant rents again after the
previous lease is ended or terminated.

## Residential scope

The default residential property types are `HOUSE`, `VILLA`,
`APARTMENT_BUILDING`, and `COMPOUND`. A space in a `MIXED_USE` property is also
residential when its space type is `APARTMENT` or `ROOM` and it has no
commercial-space profile. Commercial, warehouse, land, and other mixed-use
spaces remain outside this default invariant because one business Party may
legitimately hold multiple commercial leases.

## Enforcement

The API checks the invariant inside the serializable Lease activation
transaction and acquires deterministic tenant advisory locks for a clear
business error. PostgreSQL also maintains an
`active_residential_tenancies` registry keyed uniquely by Party. Lease-status
and Lease-party triggers keep the registry synchronized, making concurrent or
direct database writes fail atomically instead of relying on frontend checks.

Ending or terminating an active Lease removes its registry row. No historical
Lease, party, possession, or audit record is deleted.
