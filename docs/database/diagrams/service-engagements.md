# Service Engagements ERD

```mermaid
erDiagram
  Property ||--o{ ServiceEngagement : authorizes
  RentableSpace o|--o{ ServiceEngagement : overrides_for
  ServiceEngagement o|--o{ ServiceEngagement : inherits_from
  Party ||--o{ ServiceEngagementParty : participates
  ServiceEngagement ||--o{ ServiceEngagementParty : has
  ServiceEngagement ||--o{ Lease : governs
  ServiceEngagement ||--o{ BrokerageDeal : governs
  ServiceEngagement ||--o{ MaintenanceRequest : enables
```
