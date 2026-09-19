# Listing reserved for public marketing (internal workflows listing-free)

Date: 2026-09-18

## Decision

Keep the Listing model (`RentalListing` / `SaleListing`) in the backend for **future public website / public marketing** use.

Remove Listing as a **required dependency** from current **internal** Rental and Sales staff workflows.

### Internal flow (authoritative)

```
Property / RentableSpace
→ Market Intent (RENT or SALE)
→ Availability
→ Matching
→ Viewing
→ Agreement
→ Lease or Sale
```

### Do not require for internal work

- Create Listing
- Review Listing
- Publish Listing

before matching, viewing, agreement, lease, or sale.

### Internal eligibility

Based on:

- Property / RentableSpace
- Availability
- Market intent (RENT or SALE)
- Authorization (branch + permissions)

### Listing reserved for (future)

- Public property pages
- Photos and public descriptions
- SEO / featured properties
- Public asking price or rent
- Publish / unpublish for the public site
- Public website search

Staff must not be blocked because a listing is missing or unpublished.

### Technical notes (wave 1)

- Matching uses registered inventory (spaces/properties), not published-only listings.
- Viewings target `rentableSpaceId` for internal placement (listing ids remain optional for marketing paths).
- Lease / sale closure may still use Service Engagement and commercial terms; that is not a Listing publish gate.
- A DRAFT listing may be created silently only when an existing FK (for example application → listing) still requires it — never as a staff task, and never auto-published.
- Marketing listing registers and listing CRUD APIs remain available for future public use; they are not placement pipeline steps.

## Related

- `24-rental-placement-order.md` — viewing → agree → fee → lease
- ADR-001 — RentableSpace is the canonical lease/occupancy target
