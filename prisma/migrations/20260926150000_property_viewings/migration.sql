ALTER TABLE "viewings" ADD COLUMN "propertyId" UUID;

ALTER TABLE "viewings"
  ADD CONSTRAINT "viewings_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE INDEX "viewing_property_timeline_idx" ON "viewings"("propertyId", "scheduledAt" DESC);
