-- Property-level viewings select a concrete rentable space only after the visit.
ALTER TABLE "viewings"
  ADD COLUMN "selectedRentableSpaceId" UUID;

ALTER TABLE "viewings"
  ADD CONSTRAINT "viewings_selectedRentableSpaceId_fkey"
  FOREIGN KEY ("selectedRentableSpaceId") REFERENCES "rentable_spaces"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE INDEX "viewing_selected_space_timeline_idx"
  ON "viewings"("selectedRentableSpaceId", "scheduledAt" DESC);

-- propertyId was added after the original target constraint. Keep one canonical
-- visit target while allowing a separately selected unit for property visits.
ALTER TABLE "viewings" DROP CONSTRAINT IF EXISTS "viewing_exactly_one_target";
ALTER TABLE "viewings"
  ADD CONSTRAINT "viewing_exactly_one_target" CHECK (
    (("rentalListingId" IS NOT NULL)::int
      + ("saleListingId" IS NOT NULL)::int
      + ("propertyId" IS NOT NULL)::int
      + ("rentableSpaceId" IS NOT NULL)::int) = 1
  );

ALTER TABLE "viewings"
  ADD CONSTRAINT "viewing_selected_space_requires_property_target" CHECK (
    "selectedRentableSpaceId" IS NULL OR "propertyId" IS NOT NULL
  );
