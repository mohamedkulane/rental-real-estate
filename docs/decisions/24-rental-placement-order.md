# Rental placement order before lease

Date: 2026-09-18
Updated: 2026-09-18

## Decision

For rental customers, staff follow this order before a lease is created:

1. **Viewing** — schedule directly on a registered available unit (no “start rental brokerage” required)
2. **If interested** — agree monthly rent with the owner
3. **Company fee** — record that the company fee was collected
4. **Lease** — create the lease last

If the customer is **not interested** after viewing, mark that unit declined and continue matching other units.

## Enforcement

- Customer match UI shows the step pipeline and unlocks actions in order.
- Inventory units can be viewed via `Viewing.rentableSpaceId` without a published brokerage listing.
- Published listings still schedule via `rentalListingId`.
- `createRentalLease` requires a **COMPLETED** viewing for that lead on the listing or rentable space.
- Agreed rent / fee / declined flags are session-local for the match → lease handoff in wave 1.

## Related

- ADR: RentableSpace is the canonical viewing/lease target
- Brokerage engagement remains optional until commercial closure needs it
- `25-listing-for-public-marketing.md` — Listing is not required for internal placement
