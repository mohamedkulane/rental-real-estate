# Project Instructions

## Project

This repository contains a single-company, multi-branch Real Estate Rental
Company Management System.

It is not a public multi-tenant SaaS platform.

## Architecture

- Modular monolith
- Next.js frontend
- NestJS backend
- PostgreSQL
- Prisma ORM
- Redis and BullMQ
- REST API

## Critical Business Rules

- A unit cannot have more than one overlapping active lease.
- Signed contracts must not be overwritten.
- Posted financial transactions must not be deleted.
- Financial corrections must use reversal or adjustment transactions.
- Security deposits are liabilities, not company revenue.
- Owner funds must remain separate from company income.
- Owner payouts require review and approval.
- Sensitive operations must create audit logs.
- Branch users may only access permitted branch data.
- Company-wide roles may access multiple branches only when explicitly authorized.

## Development Rules

- Read the relevant files in docs/ before implementing a module.
- Do not invent business rules when documentation is unclear.
- Record assumptions in docs/decisions/.
- Use strict TypeScript.
- Validate environment variables.
- Validate all API input.
- Enforce authorization in the backend.
- Do not rely only on frontend permissions.
- Use database transactions for multi-step financial operations.
- Add tests for business-critical rules.
- Run lint, typecheck, unit tests, and integration tests before completing a task.
- Do not silently change unrelated modules.

## Definition of Done

A task is complete only when:

- Implementation is complete.
- Validation is included.
- Permissions are enforced.
- Audit behavior is implemented where required.
- Tests pass.
- Documentation is updated.
- No unrelated regressions are introduced.