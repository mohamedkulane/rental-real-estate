CREATE TYPE "PropertyServiceIntent" AS ENUM ('RENTAL_BROKERAGE', 'FULL_MANAGEMENT', 'SALE', 'CONSTRUCTION');

ALTER TABLE "properties"
  ADD COLUMN "serviceIntent" "PropertyServiceIntent",
  ADD COLUMN "salePrice" DECIMAL(20,4),
  ADD COLUMN "salePriceCurrency" CHAR(3);

ALTER TABLE "rental_applications"
  ALTER COLUMN "rentalListingId" DROP NOT NULL;
