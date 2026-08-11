# Seed and Reference Data

## Seed principles

Seeds are deterministic, idempotent, environment-aware, and contain no production personal or financial data. Reference codes are stable; labels/localization may change. Production configuration is approved data, not a developer convenience seed.

## Baseline reference candidates

- Permissions and system action types.
- RentableSpace types: apartment, room, floor, hall, shop, booth, office, warehouse, land, parking, storage, entire property.
- Charge types: rent, service charge, utility, maintenance recovery, late fee, parking, cleaning, damage, other.
- Utility types, expense categories, document categories/access classes, amenities, contact types, party/lease roles, maintenance priorities/categories.
- Payment methods as inactive/configurable templates; provider accounts are never seeded with secrets.
- Suggested chart-of-account template only after finance approval; account records are company configuration.

## Business numbering

Business-readable sequences are separate from UUID PKs and scoped as approved: propertyCode, rentableSpaceCode, leaseNumber, invoiceNumber, receiptNumber, payoutNumber, workOrderNumber, and brokerageDealNumber. Sequence allocation must be concurrency-safe and gaps are acceptable unless local law requires otherwise.
