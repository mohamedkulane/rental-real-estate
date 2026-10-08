# Legacy Property Service Intent Remediation

## Decision

`CONSTRUCTION` is not an active Property service intent. The canonical product
supports only Rental Brokerage, Full Management, and Sale.

The forward migration `20261008120000_repair_property_service_intent_enum`
sets legacy Property rows with `serviceIntent = CONSTRUCTION` to `NULL` before
rebuilding the PostgreSQL enum without that retired value.

## Rationale

Mapping a retired Construction record to Rental Brokerage, Full Management, or
Sale would invent a business classification and could make the asset eligible
for the wrong operational workflow. A blank service intent preserves the asset
record while requiring an authorized user to explicitly choose a current model
if the property returns to service.

## Operational effect

The migration restores compatibility between the database enum and Prisma, so
rental matching can safely read all active properties without a legacy value
causing an API failure.
