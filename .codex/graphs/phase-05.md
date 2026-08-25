# Phase 5 delivery graph

Canonical V3 splits Phase 5 into separately gated sub-phases. Each sub-phase gets its own run directory, contracts, review chain, gate report, and human stop.

| Sub-phase | Scope                                           | Current state                                         | Dependency                |
| --------- | ----------------------------------------------- | ----------------------------------------------------- | ------------------------- |
| 5.1       | Service Engagements and Capability Resolver     | PASS before graph bootstrap; durable commit `ed1e96d` | Phase 1–4 closure         |
| 5.2       | CRM Foundation                                  | BLOCKED — approval required                           | 5.1 PASS + human approval |
| 5.3       | Rental/Sale Listings and deterministic matching | BLOCKED                                               | 5.2 PASS + approval       |
| 5.4       | Viewings                                        | BLOCKED                                               | 5.3 PASS + approval       |
| 5.5       | Applications and Screening                      | BLOCKED                                               | 5.4 PASS + approval       |
| 5.6       | Reservations                                    | BLOCKED                                               | 5.5 PASS + approval       |
| 5.7       | Tenant Conversion and Lease Contracts           | BLOCKED                                               | 5.6 PASS + approval       |
| 5.8       | Renewals and minimal Move-In                    | BLOCKED                                               | 5.7 PASS + approval       |
| 5.9       | Full Phase 5 regression and closure             | BLOCKED                                               | 5.1–5.8 PASS + approval   |

## Durable Phase 5 boundaries

- Property is the legal/physical ownership and sale target.
- RentableSpace is the rental, occupancy, reservation, and lease target.
- Service Engagement capability resolution remains centralized and deny-by-default.
- CRM uses one canonical Lead with RENT, BUY, SELL, and CONSTRUCTION_SERVICE intents.
- Construction intent is intake only; Phase 10 models are forbidden.
- RentalListing targets RentableSpace; SaleListing targets Property.
- Matching is deterministic and explainable.
- No Phase 6 finance ledger, Phase 7 specialized completion, or Phase 10 development model leaks into Phase 5.

The Phase 5.1 implementation, migration, tests, and closure reports are represented by durable commit `ed1e96d` on branch `codex/phase5-1-service-engagements`, with canonical V3 parent commit `3371ba0`. Phase 5.2 remains unstarted. Its graph may be instantiated only from the verified graph checkpoint and after explicit human approval.
