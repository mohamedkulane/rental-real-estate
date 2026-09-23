-- Allow inventory viewings without a published brokerage listing.
ALTER TABLE "viewings" ADD COLUMN IF NOT EXISTS "rentableSpaceId" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'viewings_rentableSpaceId_fkey'
  ) THEN
    ALTER TABLE "viewings"
      ADD CONSTRAINT "viewings_rentableSpaceId_fkey"
      FOREIGN KEY ("rentableSpaceId") REFERENCES "rentable_spaces"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "viewing_space_timeline_idx"
  ON "viewings" ("rentableSpaceId", "scheduledAt" DESC);

-- Exactly one viewing target: rental listing, sale listing, or rentable space.
ALTER TABLE "viewings" DROP CONSTRAINT IF EXISTS "viewing_exactly_one_listing";
ALTER TABLE "viewings"
  ADD CONSTRAINT "viewing_exactly_one_target" CHECK (
    (("rentalListingId" IS NOT NULL)::int
      + ("saleListingId" IS NOT NULL)::int
      + ("rentableSpaceId" IS NOT NULL)::int) = 1
  );
