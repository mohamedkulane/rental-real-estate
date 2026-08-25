# Phase 5.1 Database and Migration

Migration `20260825120000_phase5_service_engagements` adds Service Model and lifecycle enums, Company canonical legal Party linkage, Service Engagement and append-only history tables, indexes, number sequence, permissions, validation functions, and triggers.

The migration upgrades existing Companies by creating one canonical Organization Party and Owner profile, then linking `Company.legalPartyId`. Fresh seed creates the same relationship idempotently.

Native controls verify same-Company Property, Space/Property membership, Property-only models, immutable activated policy, effective-period validity, exclusive/compatible overlap, serialized concurrent activation, Company ownership for Company-Owned authority, and immutable history.

Validation requires deploy/status on the upgrade database, a fresh database deploy, and repeat seed execution on both paths.
