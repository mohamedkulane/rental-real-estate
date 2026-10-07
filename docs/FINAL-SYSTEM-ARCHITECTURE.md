# Final System Architecture

The platform is a single-company, multi-branch modular monolith: Next.js web, NestJS REST API, PostgreSQL/Prisma, Redis/BullMQ where operationally useful, and object storage for protected documents.

Core boundaries are Identity and Authorization, Portfolio, Rental Brokerage, Full Management, Sales, Operations, Finance, Reporting, Administration, and independent Development. Backend services enforce company scope, effective branch scope, permission checks, validation, audit events, and transactional financial mutations. The UI is a business-facing shell over canonical workspaces; compatibility routes are redirects, not duplicate business applications.

Development owns projects, blocks, plots, budgets, costs, and output-property conversion. It does not depend on a client-build domain, construction service, construction progress, or construction permission. The forward migration removes the retired legacy tables while preserving historical migration files.

Reporting owns the bounded global search, Saved Views, generated business
documents, operational notification generation, and the unified activity
timeline read model. These capabilities read canonical domain records and
reuse existing authorization services rather than creating a second workflow
or accounting system.
