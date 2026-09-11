ALTER TABLE "leases" ADD COLUMN "applicationId" UUID;

ALTER TABLE "leases"
  ADD CONSTRAINT "leases_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "rental_applications"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE UNIQUE INDEX "leases_applicationId_key" ON "leases"("applicationId");
