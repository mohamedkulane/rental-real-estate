# System Context

## System of interest

The Real Estate Rental Company Management System is the internal system of record for one company operating multiple branches. It manages commercial pipeline, rentable inventory, contracts, operations, and auditable property/company finance.

## Human actors

- Executives and general management: company performance, controls, exceptions, approvals.
- Branch managers: branch-scoped delivery and approval.
- Leasing/property staff: portfolio, leads, contracts, occupancy, and service.
- Finance staff: posting, reconciliation, deposits, owner accounting, payables, and close.
- Maintenance/inspection staff: condition evidence and work execution.
- Owners and authorized representatives: their own properties, approvals, statements, and documents.
- Applicants/tenants: their own application, lease, balances, payments, notices, and requests.
- Vendors: assigned quotations, work, evidence, and invoices.

## External systems

- Payment providers and banks/mobile-money statements.
- Email/SMS/WhatsApp providers.
- Digital-signature provider where enabled.
- S3-compatible object storage.
- Optional identity/screening, maps/geocoding, and accounting export consumers.

## Trust boundaries

Public/portal clients are untrusted. Nginx terminates external traffic and forwards only to the web/API services. All authorization is repeated in the backend. Provider callbacks require signature/authenticity validation and idempotency. Object storage is private-by-default and accessed through short-lived authorized URLs.

## Data ownership

The application database is authoritative for transactional state and ledgers. Object storage is authoritative for binary file content, while database metadata governs identity, classification, links, versions, and access. Redis is never authoritative. Reporting projections are rebuildable from transactional data/events.

See [system context diagram](diagrams/system-context.md).
