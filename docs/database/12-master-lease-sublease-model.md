# Master Lease and Sublease Model

`MasterLease` is specialized because the company is tenant and master rent is company expense/liability. It targets a parent RentableSpace, cites the MASTER_LEASE_SUBLEASE engagement, stores contract dates/status/currency, and owns immutable version/document references and `MasterLeaseParty` roles.

`MasterLeaseRentSchedule` is effective-dated; generated `MasterLeaseCharge` is the payable source linked to journals. Deposits/incentives may use explicit terms/source records rather than managed-owner payable.

Normal `Lease` is reused for subleases with `leaseKind = SUBLEASE` and mandatory `masterLeaseId`. This avoids duplicating party, version, possession, billing, renewal, and termination concepts. Constraints ensure sublease RentableSpace is within the effective parent hierarchy and possession/term does not exceed approved master/subletting constraints.

Shared/direct costs use Expense/ExpenseAllocation and UtilityAllocation dimensions. Profitability is a read model derived from sublease revenue, master cost, vacancy, utilities, and direct/shared expenses; it is not a stored net ledger.
