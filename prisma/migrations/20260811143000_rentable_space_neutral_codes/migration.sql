UPDATE "rentable_spaces" s
SET "spaceCode" = regexp_replace(s."spaceCode", '^UNIT-', 'SPC-')
WHERE s."spaceCode" ~ '^UNIT-[0-9]{4,}$'
  AND NOT EXISTS (
    SELECT 1 FROM "rentable_spaces" conflict
    WHERE conflict."propertyId" = s."propertyId"
      AND conflict."spaceCode" = regexp_replace(s."spaceCode", '^UNIT-', 'SPC-')
  );