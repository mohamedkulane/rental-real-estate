# Phase 1 Database Acceptance Criteria

| Criterion                                      | Required evidence                                                  | Result |
| ---------------------------------------------- | ------------------------------------------------------------------ | ------ |
| Database documents internally consistent       | Cross-reference/model/terminology review                           | PASS   |
| Consolidated `schema-candidate.prisma`         | One candidate; duplicate-name/static relation checks               | PASS   |
| No duplicate entity strategy                   | Party, Lease, Finance, ServiceEngagement ownership documented once | PASS   |
| Decimal money/percentage/measurement           | Candidate static scan and type policy                              | PASS   |
| RentableSpace canonical                        | No `Unit` model; Lease/Reservation/Brokerage target space IDs      | PASS   |
| ServiceEngagement effective-dated              | Date fields, status/model, scope and overlap package               | PASS   |
| Immutable records classified                   | Retention matrix and trigger strategies                            | PASS   |
| Native PostgreSQL controls documented          | Consolidated review SQL with module/transaction comments           | PASS   |
| Chart of Accounts baseline approved for design | Minimum reserved/configurable seed table                           | PASS   |
| UUID strategy chosen                           | Application-generated UUIDv7-compatible IDs with UUIDv4 fallback   | PASS   |
| Database test plan exists                      | Schema/native/finance/migration cases                              | PASS   |
| No critical database-design blocker            | Completion review                                                  | PASS   |

## Gate interpretation

PASS means the candidate is coherent enough to enter Phase 2 foundation work after explicit authorization. It does not authorize production migration, package installation, application features, or promotion to `prisma/schema.prisma`. The first Phase 2 database action must run the official Prisma parser/validator and executable PostgreSQL constraint suite defined in the test plan.
