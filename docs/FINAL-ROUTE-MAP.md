# Final Route Map

There are 102 physical Next.js page files in the historical-compatible application shell. The normal staff experience is smaller and canonical:

- `/` -> login entry
- `/portfolio` -> Owners, Properties, Buildings, Rentable Spaces, Amenities
- `/rental/customers` -> rental customer workflow
- `/commercial/rental-brokerage` -> brokerage authority, deals, and commission
- `/commercial/full-management` -> management authority, leases, billing, statements, and payouts
- `/leasing/leases` -> canonical lease workspace
- `/sales` -> sales overview
- `/sales/buyers` -> buyers
- `/sales/properties` -> sale properties
- `/sales/deals` -> sale agreements and settlements
- `/viewings` -> canonical viewing register
- `/operations` -> operations overview
- `/operations/maintenance`, `/operations/work-orders`, `/operations/inspections`, `/operations/vendors`
- `/finance/payments`, `/finance/expenses`, `/finance/owner-statements`, `/finance/owner-payouts`
- `/reports` -> reports and exports
- `/development` -> independent Development workspace
- `/admin` -> branches, employees, roles, permissions, settings, and audit

Compatibility redirects remain for older CRM, leasing, marketing, portfolio, and commercial URLs. They forward users to the canonical workspace and do not maintain duplicate React workspaces. The retired Construction routes were removed.
