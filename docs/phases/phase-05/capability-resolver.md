# Phase 5.1 Capability Resolver

`GET /api/v1/service-capabilities/resolve` accepts a Property, optional RentableSpace, and optional business date. It returns boolean capabilities, contributing Property/Space Engagements, the resolved branch, date, and rental-policy source.

Capabilities cover rental/sale listing, marketing, rental/buyer/seller lead intake, viewings, applications, reservations, leases, rent collection, and maintenance management.

The resolver is deny-by-default. It considers only Active Engagements effective on the requested date. Property rental authority is inherited when no effective Space override exists. A Space rental Engagement replaces Property rental authority for that Space, while Property-wide sale authority remains inherited. Company-Owned at Property scope supplies rental and sale authority only when there is no Space rental override.

Future Phase 5 modules must call this resolver or its service policy. They must not reproduce model-to-capability conditionals.
