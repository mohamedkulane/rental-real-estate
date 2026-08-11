# Leasing Data Model

## Lease aggregate

`Lease` stores identity/number, RentableSpace, ServiceEngagement, kind, current status, agreement/start/possession/end dates, currency, and concurrency version. `LeaseParty` records tenant, co-tenant, guarantor, witness, or landlord-side roles with effective participation.

`LeaseVersion` is immutable and stores structured term snapshot, RentableSpaceVersion, document version, signature status/hash evidence, effective dates, and sequence. Amendments, renewals, extensions, and termination records link predecessor/successor versions instead of overwriting.

## Possession and exclusivity

`LeasePossession` records actual/scheduled exclusive possession interval and lifecycle. A PostgreSQL GiST exclusion constraint rejects overlapping active half-open ranges for the same RentableSpace. Prisma maps the table but native migrations own the exclusion. Reservations are separate availability blocks and never create occupancy.

## Operational records

MoveIn/MoveOut capture completion and inspection references. KeyAssignment and MeterReading preserve handover evidence. RecurringChargeSchedule is an effective-dated billing instruction; generated Charge rows retain schedule/version calculation inputs. Waivers are explicit and never delete charges.

## Dates

Agreement, lease start, possession, and lease end are separate `date` fields. Holdover is a Lease state/recorded event after contractual end while possession remains active; no silent renewal occurs.
