# Proposed Commercial Schema Blocks

```prisma
model BrokerageDeal { id String @id @db.Uuid engagementId String @db.Uuid rentableSpaceId String @db.Uuid leadId String? @db.Uuid viewingId String? @db.Uuid applicationId String? @db.Uuid dealNumber String @unique @db.VarChar(50) status String @db.VarChar(30) rentBasis Decimal? @db.Decimal(20,4) grossCommission Decimal @db.Decimal(20,4) agentCommission Decimal? @db.Decimal(20,4) currency String @db.Char(3) closedAt DateTime? @db.Timestamptz(6) parties BrokerageDealParty[] @@index([rentableSpaceId,status]) @@map("brokerage_deals") }
model BrokerageDealParty { dealId String @db.Uuid partyId String @db.Uuid role String @db.VarChar(30) deal BrokerageDeal @relation(fields:[dealId],references:[id]) @@id([dealId,partyId,role]) @@map("brokerage_deal_parties") }
```
