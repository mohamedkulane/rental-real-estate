# Canonical sales workflow

## Decision

Sales inventory is property-based. A property is eligible for the internal
sales workspace only when it is active, has Sale intent, has a current active
sale service engagement, and has no accepted offer, confirmed agreement, or
settled settlement. Public `SaleListing` records remain a publishing surface;
they are not the source of truth for internal availability.

An interested completed viewing is required before a sale agreement can be
created. The agreement records the final sale price and commission terms. A
confirmed agreement creates the accepted sale offer used by settlement. A
settled sale marks the property SOLD, which removes it from future inventory
and matching results.

Company-owned sales do not require seller commission terms and route the sale
proceeds to the company. External-owner sales require seller commission
terms. Settlement inherits the confirmed agreement price and terms rather than
accepting a second, conflicting price from the settlement form.

## Rationale

This keeps sales availability, buyer matching, viewing history, agreement
authority, and financial settlement on one lifecycle. It also prevents a
published listing or a stale form from making a sold property appear
available.

## Consequences

- The Sales Overview and Sales Properties workspace use property inventory.
- Sales Deals is backed by `SaleAgreement` and its linked `SaleOffer` and
  `SaleSettlement` records.
- Direct property viewings are supported for properties without a published
  listing.
- Existing public listing endpoints remain available for publishing and
  public-facing workflows, but do not define internal sale inventory.
