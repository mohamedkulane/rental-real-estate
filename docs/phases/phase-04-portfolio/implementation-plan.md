# Implementation Plan

1. Extend Prisma with Party profiles, Owner, Property, Building, ownership, RentableSpace hierarchy/version profiles, amenities, documents, and effective branch assignments.
2. Add a deployable native PostgreSQL migration for exclusion constraints, deferred hierarchy/area/configuration controls, and document-version immutability.
3. Seed authoritative reference types, amenities, permissions, and role grants idempotently.
4. Implement validated REST endpoints with backend permission and object-level branch checks.
5. Implement transactional ownership, branch transfer, partition, reparenting, measurement correction, retirement, amenity, document, and audit behavior.
6. Add authenticated internal UI for create, list, detail, edit, ownership, buildings, hierarchy, measurements, partition, retirement, branch assignment, amenities, and land data.
7. Prove clean-install and Phase 3 upgrade migration paths; run unit, PostgreSQL integration, E2E, regression, lint, typecheck, Prisma, and build gates.
8. Record acceptance evidence and stop before Phase 5.
