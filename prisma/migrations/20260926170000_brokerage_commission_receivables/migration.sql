CREATE TYPE "BrokerageCommissionSide" AS ENUM ('OWNER', 'TENANT');

ALTER TABLE "charges"
  ADD COLUMN "brokerageDealId" UUID,
  ADD COLUMN "commissionSide" "BrokerageCommissionSide";

ALTER TABLE "payment_methods"
  ADD COLUMN "receivingAccountId" UUID;

ALTER TABLE "charges"
  ADD CONSTRAINT "charges_brokerageDealId_fkey"
  FOREIGN KEY ("brokerageDealId") REFERENCES "brokerage_deals"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "payment_methods"
  ADD CONSTRAINT "payment_methods_receivingAccountId_fkey"
  FOREIGN KEY ("receivingAccountId") REFERENCES "accounts"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE UNIQUE INDEX "uq_charge_brokerage_commission_side"
  ON "charges"("brokerageDealId", "commissionSide");

CREATE INDEX "charge_brokerage_deal_status_idx"
  ON "charges"("brokerageDealId", "status");

UPDATE "payment_methods" AS method
SET "receivingAccountId" = account.id
FROM "accounts" AS account
WHERE account."companyId" = method."companyId"
  AND account.code = CASE
    WHEN method.code IN ('EVC', 'EDAHAB', 'SOMNET') THEN '1030'
    WHEN method.code = 'SALAAM_BANK' THEN '1020'
  END
  AND method.code IN ('EVC', 'EDAHAB', 'SOMNET', 'SALAAM_BANK');

INSERT INTO "charges" (
  id, "companyId", "branchId", "chargeNumber", "debtorPartyId",
  "propertyId", "rentableSpaceId", "serviceEngagementId", "chargeTypeId",
  "brokerageDealId", "commissionSide", "businessDate", "dueDate", currency,
  "originalAmount", "outstandingAmount", status, "idempotencyKey", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(), deal."companyId", deal."branchId",
  'MIG-' || left(deal."dealNumber", 34) || '-OWN', agreement."ownerPartyId",
  agreement."propertyId", agreement."rentableSpaceId", deal."serviceEngagementId", charge_type.id,
  deal.id, 'OWNER'::"BrokerageCommissionSide", COALESCE(agreement."confirmedAt"::date, CURRENT_DATE),
  COALESCE(agreement."confirmedAt"::date, CURRENT_DATE), agreement.currency,
  CASE agreement."ownerCommissionMethod"
    WHEN 'PERCENT' THEN agreement."finalRent" * agreement."ownerCommissionValue" / 100
    ELSE agreement."ownerCommissionValue"
  END,
  CASE agreement."ownerCommissionMethod"
    WHEN 'PERCENT' THEN agreement."finalRent" * agreement."ownerCommissionValue" / 100
    ELSE agreement."ownerCommissionValue"
  END,
  'OPEN'::"ChargeStatus", 'brokerage:' || deal.id || ':OWNER', now(), now()
FROM "brokerage_deals" deal
JOIN "rental_agreements" agreement ON agreement.id = deal."rentalAgreementId"
JOIN "charge_types" charge_type ON charge_type."companyId" = deal."companyId" AND charge_type.code = 'OWNER_COMMISSION'
WHERE deal.status IN ('CONFIRMED', 'CLOSED')
  AND agreement."ownerCommissionMethod" IS NOT NULL
  AND agreement."ownerCommissionValue" > 0
ON CONFLICT ("brokerageDealId", "commissionSide") DO NOTHING;

INSERT INTO "charges" (
  id, "companyId", "branchId", "chargeNumber", "debtorPartyId",
  "propertyId", "rentableSpaceId", "serviceEngagementId", "chargeTypeId",
  "brokerageDealId", "commissionSide", "businessDate", "dueDate", currency,
  "originalAmount", "outstandingAmount", status, "idempotencyKey", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(), deal."companyId", deal."branchId",
  'MIG-' || left(deal."dealNumber", 34) || '-TEN', agreement."customerPartyId",
  agreement."propertyId", agreement."rentableSpaceId", deal."serviceEngagementId", charge_type.id,
  deal.id, 'TENANT'::"BrokerageCommissionSide", COALESCE(agreement."confirmedAt"::date, CURRENT_DATE),
  COALESCE(agreement."confirmedAt"::date, CURRENT_DATE), agreement.currency,
  CASE agreement."tenantCommissionMethod"
    WHEN 'PERCENT' THEN agreement."finalRent" * agreement."tenantCommissionValue" / 100
    ELSE agreement."tenantCommissionValue"
  END,
  CASE agreement."tenantCommissionMethod"
    WHEN 'PERCENT' THEN agreement."finalRent" * agreement."tenantCommissionValue" / 100
    ELSE agreement."tenantCommissionValue"
  END,
  'OPEN'::"ChargeStatus", 'brokerage:' || deal.id || ':TENANT', now(), now()
FROM "brokerage_deals" deal
JOIN "rental_agreements" agreement ON agreement.id = deal."rentalAgreementId"
JOIN "charge_types" charge_type ON charge_type."companyId" = deal."companyId" AND charge_type.code = 'TENANT_COMMISSION'
WHERE deal.status IN ('CONFIRMED', 'CLOSED')
  AND agreement."tenantCommissionMethod" IS NOT NULL
  AND agreement."tenantCommissionValue" > 0
ON CONFLICT ("brokerageDealId", "commissionSide") DO NOTHING;
