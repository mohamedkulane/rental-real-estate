# Phase 5.1 Service Engagements

## Aggregate

An Engagement records why the company is authorized to perform commercial work for a Property or, for rental policy, a RentableSpace. It stores a stable number, model, lifecycle status, Property scope, optional Space scope, effective period, notes, optimistic version, creator, timestamps, append-only lifecycle history, and normal audit events.

## Models and compatibility

| Model                   | Property | Space | May overlap at same scope     |
| ----------------------- | -------- | ----- | ----------------------------- |
| Rental Brokerage        | Yes      | Yes   | Sale Brokerage                |
| Sale Brokerage          | Yes      | No    | Any one rental-oriented model |
| Tenant Placement        | Yes      | Yes   | Sale Brokerage                |
| Full Management         | Yes      | Yes   | Sale Brokerage                |
| Rent Collection Only    | Yes      | Yes   | Sale Brokerage                |
| Master Lease / Sublease | Yes      | Yes   | Sale Brokerage                |
| Company Owned           | Yes      | No    | None                          |

The matrix is deny-by-default. Effective intervals are half-open; touching end/start dates do not overlap.

## Lifecycle

Drafts are editable. Activation verifies active physical scope, authorization, compatibility, and Company ownership when applicable. Activated policy is immutable. Current Active records may be deactivated with a reason; scheduled Active records may be cancelled; Drafts may be cancelled. Active records whose end date has passed are presented as Expired. Every state change appends history and audit evidence.

## Read model

The register is independent and server-backed. It supports case-insensitive search over Engagement number, Property name/code, and Space name/code; Property, Space, Branch, Service Model, Status, and period filters; cursor pagination; deterministic `createdAt DESC, id DESC` ordering; and a database count using the same authorized filter.
