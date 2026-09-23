ALTER TABLE "leases"
  ALTER COLUMN "leaseEndDate" DROP NOT NULL;

ALTER TABLE "rental_agreements"
  ALTER COLUMN "leaseEndDate" DROP NOT NULL;
