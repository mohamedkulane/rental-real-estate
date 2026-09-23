# Open-ended rental leases

## Decision

Rental agreements and leases require a start date but allow a null end date.
An omitted end date means the tenancy continues until an explicit lease
termination/end workflow records the actual departure. Existing end dates are
preserved unchanged.

## Integrity rules

- A null end date is treated as extending indefinitely for availability and
  parent/child occupancy conflict checks.
- A lease with no end date cannot be renewed until it has an explicit end.
- Move-in remains valid for any date on or after the lease start when the lease
  is open-ended.
- Lease possession remains open-ended (`possessionTo = null`) until move-out.
