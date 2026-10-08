-- Construction was removed from the active product. Do not infer another
-- service model for historical records: an absent intent is safer than
-- silently recategorising an old Construction property as rental or sale.
UPDATE "properties"
SET "serviceIntent" = NULL
WHERE "serviceIntent"::text = 'CONSTRUCTION';

-- PostgreSQL cannot remove a single enum value in place. Rebuild the type
-- after clearing the retired value so Prisma and the database agree.
ALTER TYPE "PropertyServiceIntent" RENAME TO "PropertyServiceIntent_legacy";

CREATE TYPE "PropertyServiceIntent" AS ENUM (
  'RENTAL_BROKERAGE',
  'FULL_MANAGEMENT',
  'SALE'
);

ALTER TABLE "properties"
  ALTER COLUMN "serviceIntent" TYPE "PropertyServiceIntent"
  USING "serviceIntent"::text::"PropertyServiceIntent";

DROP TYPE "PropertyServiceIntent_legacy";
