ALTER TABLE "owner_statements" ADD COLUMN "propertyId" UUID;
ALTER TABLE "owner_statements" ADD COLUMN "idempotencyKey" VARCHAR(180);

UPDATE "owner_statements"
SET "idempotencyKey" = 'legacy:' || "id"::text
WHERE "idempotencyKey" IS NULL;

ALTER TABLE "owner_statements" ALTER COLUMN "idempotencyKey" SET NOT NULL;

CREATE UNIQUE INDEX "owner_statements_idempotencyKey_key" ON "owner_statements"("idempotencyKey");
CREATE INDEX "owner_statement_owner_property_period_idx" ON "owner_statements"("ownerPartyId", "propertyId", "periodStart");

ALTER TABLE "owner_statements"
  ADD CONSTRAINT "owner_statements_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "owner_statement_lines" ADD COLUMN "lineCode" VARCHAR(40);

UPDATE "owner_statement_lines"
SET "lineCode" = 'LEGACY'
WHERE "lineCode" IS NULL;

ALTER TABLE "owner_statement_lines" ALTER COLUMN "lineCode" SET NOT NULL;

CREATE SEQUENCE IF NOT EXISTS owner_statement_record_number_seq START WITH 1 INCREMENT BY 1;
