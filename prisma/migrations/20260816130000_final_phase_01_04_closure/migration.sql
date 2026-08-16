ALTER TABLE "documents" ADD COLUMN "displayName" VARCHAR(240);

UPDATE "documents" AS d
SET "displayName" = COALESCE(
  NULLIF(regexp_replace((
    SELECT v."storageKey"
    FROM "document_versions" AS v
    WHERE v."documentId" = d."id"
    ORDER BY v."sequence"
    LIMIT 1
  ), '^.*/', ''), ''),
  d."categoryCode"
);

ALTER TABLE "documents" ALTER COLUMN "displayName" SET NOT NULL;
CREATE INDEX "documents_company_created_id_idx"
  ON "documents" ("companyId", "createdAt" DESC, "id" DESC);