# Formal Move-Out Workflow

Status: accepted

## Decision

Formal move-out is the canonical command for ending an active residential
tenancy. It requires an active lease, an active `LeasePossession`, authorized
lease-management access, an effective move-out date, and a reason. The command
ends the active possession and transitions the lease to `ENDED` in one
serializable transaction, then records an audit event. The lease version is
checked both before and inside the transaction so stale or concurrent requests
cannot silently succeed.

`LeasePossession` remains the source of truth for physical occupancy. Move-out
facts are retained on the possession record (`moveOutReason` and
`moveOutNotes`) and its existing interval is closed with `possessionTo`.
Signed lease history and brokerage/service history are not overwritten.

## Constraints

- A normal `ACTIVE` to `ENDED` transition cannot be performed through the
  generic lease transition endpoint; callers must use formal move-out.
- Fixed-term move-out cannot be before possession start or after the lease end.
  Open-ended leases may be ended on any valid date after possession starts.
- Availability requires physical vacancy and an active, currently effective
  rental service authority. Historical or inactive service engagements do not
  make a space matchable.
- Customer identity is reused through the existing party/lease relationships;
  move-out does not create a replacement customer.
- Exceptional termination remains available through the existing termination
  workflow and is distinct from normal physical move-out.

## Verification

The integration coverage exercises normal and open-ended move-out, invalid and
duplicate/concurrent requests, possession closure, lease history, successor
activation, authorization, and matching eligibility after physical vacancy and
service-authority changes.
