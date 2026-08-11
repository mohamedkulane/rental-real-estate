# Brokerage ERD

```mermaid
erDiagram
  ServiceEngagement ||--o{ BrokerageDeal : governs
  RentableSpace ||--o{ BrokerageDeal : target
  Lead o|--o{ BrokerageDeal : sources
  Viewing o|--o{ BrokerageDeal : sources
  Application o|--o{ BrokerageDeal : sources
  BrokerageDeal ||--o{ BrokerageDealParty : has
  Party ||--o{ BrokerageDealParty : participates
  BrokerageDeal ||--o| JournalSourceLink : posts
```
