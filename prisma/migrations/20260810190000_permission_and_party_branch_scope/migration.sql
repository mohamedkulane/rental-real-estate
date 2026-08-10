CREATE TABLE "party_branch_assignments" (
  "id" UUID NOT NULL,
  "partyId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  CONSTRAINT "party_branch_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "party_branch_assignments_effective_range_check"
    CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")
);

CREATE UNIQUE INDEX "party_branch_assignments_partyId_branchId_effectiveFrom_key"
  ON "party_branch_assignments"("partyId", "branchId", "effectiveFrom");
CREATE INDEX "party_branch_assignments_partyId_effectiveFrom_idx"
  ON "party_branch_assignments"("partyId", "effectiveFrom");
CREATE INDEX "party_branch_assignments_branchId_effectiveFrom_idx"
  ON "party_branch_assignments"("branchId", "effectiveFrom");

ALTER TABLE "party_branch_assignments"
  ADD CONSTRAINT "party_branch_assignments_partyId_fkey"
  FOREIGN KEY ("partyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "party_branch_assignments"
  ADD CONSTRAINT "party_branch_assignments_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "party_branch_assignments"
  ADD CONSTRAINT "party_branch_assignments_no_overlap"
  EXCLUDE USING gist (
    "partyId" WITH =,
    "branchId" WITH =,
    daterange("effectiveFrom", "effectiveTo", '[)') WITH &&
  );

INSERT INTO "party_branch_assignments" ("id", "partyId", "branchId", "effectiveFrom", "effectiveTo")
SELECT gen_random_uuid(), e."partyId", eba."branchId", eba."effectiveFrom", eba."effectiveTo"
FROM "employees" e
JOIN "employee_branch_assignments" eba ON eba."employeeId" = e."id"
ON CONFLICT DO NOTHING;

INSERT INTO "party_branch_assignments" ("id", "partyId", "branchId", "effectiveFrom", "effectiveTo")
SELECT DISTINCT ON (po."ownerPartyId", pba."branchId", GREATEST(po."effectiveFrom", pba."effectiveFrom"))
  gen_random_uuid(),
  po."ownerPartyId",
  pba."branchId",
  GREATEST(po."effectiveFrom", pba."effectiveFrom"),
  CASE
    WHEN po."effectiveTo" IS NULL THEN pba."effectiveTo"
    WHEN pba."effectiveTo" IS NULL THEN po."effectiveTo"
    ELSE LEAST(po."effectiveTo", pba."effectiveTo")
  END
FROM "property_ownerships" po
JOIN "property_branch_assignments" pba ON pba."propertyId" = po."propertyId"
WHERE daterange(po."effectiveFrom", po."effectiveTo", '[)') &&
      daterange(pba."effectiveFrom", pba."effectiveTo", '[)')
ORDER BY po."ownerPartyId", pba."branchId", GREATEST(po."effectiveFrom", pba."effectiveFrom")
ON CONFLICT DO NOTHING;

INSERT INTO "party_branch_assignments" ("id", "partyId", "branchId", "effectiveFrom", "effectiveTo")
SELECT gen_random_uuid(), p."id", b."id", CURRENT_DATE, NULL
FROM "parties" p
JOIN LATERAL (
  SELECT "id" FROM "branches"
  WHERE "companyId" = p."companyId"
  ORDER BY "createdAt", "id"
  LIMIT 1
) b ON TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM "party_branch_assignments" pba WHERE pba."partyId" = p."id"
);
-- General managers retain business oversight but do not administer role definitions or grants.
DELETE FROM "role_permissions" rp
USING "roles" r, "permissions" p
WHERE rp."roleId" = r."id"
  AND rp."permissionId" = p."id"
  AND r."code" = 'GENERAL_MANAGER'
  AND p."code" = 'identity.role.manage';