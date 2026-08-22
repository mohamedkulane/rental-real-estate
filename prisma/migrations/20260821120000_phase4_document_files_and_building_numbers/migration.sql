CREATE SEQUENCE IF NOT EXISTS building_record_number_seq START WITH 1 INCREMENT BY 1;

DO $$
DECLARE maximum_value BIGINT;
BEGIN
  SELECT COALESCE(MAX((regexp_match("buildingCode", '^BLD-([0-9]+)$'))[1]::BIGINT), 0)
  INTO maximum_value
  FROM buildings;
  PERFORM setval('building_record_number_seq', maximum_value + 1, false);
END $$;

ALTER TABLE documents
  ADD COLUMN notes TEXT,
  ADD COLUMN "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now();

ALTER TABLE document_versions
  ADD COLUMN "originalFilename" VARCHAR(255) NOT NULL DEFAULT 'legacy-file',
  ADD COLUMN "uploadedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now();
ALTER TABLE document_versions ALTER COLUMN "originalFilename" DROP DEFAULT;

CREATE INDEX documents_company_status_category_updated_idx
  ON documents ("companyId", status, "categoryCode", "updatedAt" DESC);
