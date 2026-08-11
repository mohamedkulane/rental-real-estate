# Relationship Map

- Company has Branches, Employees, Roles, policies, accounts, and company-level Parties.
- Employee links a User to a Party and receives effective branch assignments and roles/scopes.
- Party has exactly one person or organization profile and zero or more role profiles; profiles do not duplicate identity/contact data.
- Property has effective operating-branch history, ownership interests, entitlements, optional Buildings, and RentableSpaces.
- RentableSpace has immutable effective versions and effective parent relations to other spaces; historical LeaseVersion cites both stable space and governing space version.
- ServiceEngagement always belongs to a Property and optionally a RentableSpace; a space target must belong to that Property. Parent/property engagement may be explicitly inherited or overridden.
- Lead preserves source and assignment history; listing/viewing/application/reservation all target RentableSpace.
- Lease targets RentableSpace, references ServiceEngagement, contains party roles and immutable signed versions, and owns possession intervals.
- BrokerageDeal targets RentableSpace and may reference lead, viewing, or application; it has party roles and Finance source links.
- Charge is the receivable source; invoices group charge-backed lines. Payment allocations join posted payments to charges.
- Every JournalEntry has balanced JournalLines and at most one typed JournalSourceLink whose nullable FKs are constrained to exactly one source.
- Owner accounting derives from journal dimensions; statements/payable calculations/payout lines snapshot approved results.
- Deposit is lease-scoped; contributors are Parties and immutable transactions feed settlement/dispute/transfer records.
- MasterLease targets a parent RentableSpace; normal Lease may reference it as a sublease, avoiding duplicate sublease contract tables.
- Utility allocations snapshot input factors and produce lines/charges traceable to the source bill.
- Maintenance/inspection target Property and optional RentableSpace, gated by ServiceEngagement; vendor bills recognize payable/expense through Finance.
- ApprovalRequest is linked from sensitive target records; AuditLog/OutboxEvent use controlled entity locators for cross-module evidence/events.

See the ER diagrams under `docs/database/diagrams/`.
