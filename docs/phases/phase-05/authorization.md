# Phase 5.1 Authorization

Permissions:

- `service-engagement.read`
- `service-engagement.create`
- `service-engagement.update`
- `service-engagement.activate`
- `service-engagement.deactivate`
- `service-engagement.cancel`
- `service-engagement.capability.read`

Every API enforces permissions in the backend. Object reads and writes resolve the Property's effective branch and call branch authorization. Lists intersect requested Branch with authorized Branches. Company-wide access is allowed only by an explicitly company-wide principal with the permission. Every query includes `companyId`; Space scope must belong to the selected Property and Company.

Branch Manager and Property Manager receive lifecycle management permissions in development seed roles. Leasing Agent and Accountant receive read and resolver permissions. Super Admin and General Manager inherit permitted company-wide access from their roles.
