CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'DISABLED');
CREATE TYPE "BranchAccessMode" AS ENUM ('BRANCH', 'MULTI_BRANCH', 'COMPANY_WIDE');
CREATE TYPE "PartyKind" AS ENUM ('PERSON', 'ORGANIZATION');
CREATE TYPE "ApprovalStatus" AS ENUM ('REQUESTED', 'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'WITHDRAWN');

CREATE TABLE "companies" (
  "id" UUID PRIMARY KEY,
  "singletonKey" BOOLEAN NOT NULL DEFAULT TRUE UNIQUE,
  "code" VARCHAR(32) NOT NULL UNIQUE,
  "name" VARCHAR(200) NOT NULL,
  "legalName" VARCHAR(240),
  "displayName" VARCHAR(200),
  "phone" VARCHAR(40),
  "email" VARCHAR(320),
  "address" JSONB,
  "logoMetadata" JSONB,
  "defaultCurrency" CHAR(3) NOT NULL,
  "timezone" VARCHAR(64) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL
);

CREATE TABLE "branches" (
  "id" UUID PRIMARY KEY,
  "companyId" UUID NOT NULL REFERENCES "companies"("id") ON DELETE RESTRICT,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "address" JSONB,
  "phone" VARCHAR(40),
  "email" VARCHAR(320),
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "uq_branches__company_code" UNIQUE ("companyId", "code")
);

CREATE TABLE "departments" (
  "id" UUID PRIMARY KEY,
  "companyId" UUID NOT NULL REFERENCES "companies"("id") ON DELETE RESTRICT,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE ("companyId", "code")
);

CREATE TABLE "users" (
  "id" UUID PRIMARY KEY,
  "emailNormalized" VARCHAR(320) NOT NULL UNIQUE,
  "passwordHash" VARCHAR(255),
  "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
  "passwordChangedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL
);

CREATE TABLE "sessions" (
  "id" UUID PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "tokenHash" CHAR(64) NOT NULL UNIQUE,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "lastActivityAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMPTZ(6),
  "revocationReason" VARCHAR(255),
  "ipAddress" VARCHAR(64),
  "userAgent" VARCHAR(512)
);
CREATE INDEX "sessions_userId_expiresAt_idx" ON "sessions"("userId", "expiresAt");

CREATE TABLE "password_reset_tokens" (
  "id" UUID PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "tokenHash" CHAR(64) NOT NULL UNIQUE,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "usedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "password_reset_tokens_userId_expiresAt_idx" ON "password_reset_tokens"("userId", "expiresAt");

CREATE TABLE "parties" (
  "id" UUID PRIMARY KEY,
  "companyId" UUID NOT NULL REFERENCES "companies"("id") ON DELETE RESTRICT,
  "partyNumber" VARCHAR(40) NOT NULL,
  "kind" "PartyKind" NOT NULL,
  "displayName" VARCHAR(240) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE ("companyId", "partyNumber")
);

CREATE TABLE "employees" (
  "id" UUID PRIMARY KEY,
  "companyId" UUID NOT NULL REFERENCES "companies"("id") ON DELETE RESTRICT,
  "userId" UUID UNIQUE REFERENCES "users"("id") ON DELETE RESTRICT,
  "partyId" UUID NOT NULL UNIQUE REFERENCES "parties"("id") ON DELETE RESTRICT,
  "employeeNumber" VARCHAR(40) NOT NULL,
  "accessMode" "BranchAccessMode" NOT NULL,
  "jobTitle" VARCHAR(120),
  "hireDate" DATE,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  UNIQUE ("companyId", "employeeNumber")
);

CREATE TABLE "employee_branch_assignments" (
  "id" UUID PRIMARY KEY,
  "employeeId" UUID NOT NULL REFERENCES "employees"("id") ON DELETE RESTRICT,
  "branchId" UUID NOT NULL REFERENCES "branches"("id") ON DELETE RESTRICT,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  UNIQUE ("employeeId", "branchId", "effectiveFrom"),
  CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")
);
CREATE INDEX "employee_branch_assignments_employeeId_effectiveFrom_idx" ON "employee_branch_assignments"("employeeId", "effectiveFrom");
ALTER TABLE "employee_branch_assignments" ADD CONSTRAINT "employee_branch_assignments_no_overlap" EXCLUDE USING gist (
  "employeeId" WITH =,
  "branchId" WITH =,
  daterange("effectiveFrom", COALESCE("effectiveTo", 'infinity'::date), '[)') WITH &&
);

CREATE TABLE "roles" (
  "id" UUID PRIMARY KEY,
  "companyId" UUID NOT NULL REFERENCES "companies"("id") ON DELETE RESTRICT,
  "code" VARCHAR(64) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE ("companyId", "code")
);

CREATE TABLE "permissions" (
  "id" UUID PRIMARY KEY,
  "code" VARCHAR(100) NOT NULL UNIQUE,
  "description" VARCHAR(255) NOT NULL
);

CREATE TABLE "role_permissions" (
  "roleId" UUID NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  "permissionId" UUID NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE,
  PRIMARY KEY ("roleId", "permissionId")
);

CREATE TABLE "employee_roles" (
  "id" UUID PRIMARY KEY,
  "employeeId" UUID NOT NULL REFERENCES "employees"("id") ON DELETE RESTRICT,
  "roleId" UUID NOT NULL REFERENCES "roles"("id") ON DELETE RESTRICT,
  "branchId" UUID REFERENCES "branches"("id") ON DELETE RESTRICT,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  UNIQUE ("employeeId", "roleId", "branchId", "effectiveFrom"),
  CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")
);
CREATE INDEX "employee_roles_employeeId_effectiveFrom_idx" ON "employee_roles"("employeeId", "effectiveFrom");

CREATE TABLE "approval_policies" (
  "id" UUID PRIMARY KEY,
  "companyId" UUID NOT NULL REFERENCES "companies"("id") ON DELETE RESTRICT,
  "code" VARCHAR(60) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE ("companyId", "code", "effectiveFrom"),
  CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")
);

CREATE TABLE "approval_rules" (
  "id" UUID PRIMARY KEY,
  "policyId" UUID NOT NULL REFERENCES "approval_policies"("id") ON DELETE RESTRICT,
  "actionType" VARCHAR(60) NOT NULL,
  "minAmount" DECIMAL(20,4),
  "maxAmount" DECIMAL(20,4),
  "currency" CHAR(3),
  "sequence" INTEGER NOT NULL,
  "makerChecker" BOOLEAN NOT NULL DEFAULT TRUE,
  "allowDelegation" BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE "approval_requests" (
  "id" UUID PRIMARY KEY,
  "policyId" UUID NOT NULL REFERENCES "approval_policies"("id") ON DELETE RESTRICT,
  "makerEmployeeId" UUID NOT NULL REFERENCES "employees"("id") ON DELETE RESTRICT,
  "branchId" UUID REFERENCES "branches"("id") ON DELETE RESTRICT,
  "actionType" VARCHAR(60) NOT NULL,
  "targetType" VARCHAR(60) NOT NULL,
  "targetId" UUID NOT NULL,
  "amount" DECIMAL(20,4),
  "currency" CHAR(3),
  "status" "ApprovalStatus" NOT NULL,
  "correlationId" UUID
);
CREATE INDEX "approval_requests_status_branchId_idx" ON "approval_requests"("status", "branchId");

CREATE TABLE "approval_steps" (
  "id" UUID PRIMARY KEY,
  "requestId" UUID NOT NULL REFERENCES "approval_requests"("id") ON DELETE RESTRICT,
  "sequence" INTEGER NOT NULL,
  "status" VARCHAR(30) NOT NULL,
  "requiredRoleCode" VARCHAR(60),
  UNIQUE ("requestId", "sequence")
);

CREATE TABLE "approval_decisions" (
  "id" UUID PRIMARY KEY,
  "stepId" UUID NOT NULL REFERENCES "approval_steps"("id") ON DELETE RESTRICT,
  "approverEmployeeId" UUID NOT NULL REFERENCES "employees"("id") ON DELETE RESTRICT,
  "outcome" VARCHAR(20) NOT NULL,
  "reason" TEXT,
  "delegatedFromEmployeeId" UUID REFERENCES "employees"("id") ON DELETE RESTRICT,
  "emergencyOverride" BOOLEAN NOT NULL DEFAULT FALSE,
  "decidedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "audit_logs" (
  "id" UUID PRIMARY KEY,
  "actorUserId" UUID REFERENCES "users"("id") ON DELETE RESTRICT,
  "effectiveActorUserId" UUID REFERENCES "users"("id") ON DELETE RESTRICT,
  "action" VARCHAR(100) NOT NULL,
  "entityType" VARCHAR(80) NOT NULL,
  "entityId" UUID,
  "branchId" UUID REFERENCES "branches"("id") ON DELETE RESTRICT,
  "requestId" UUID,
  "correlationId" UUID,
  "reason" TEXT,
  "beforeSnapshot" JSONB,
  "afterSnapshot" JSONB,
  "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "audit_logs_entityType_entityId_occurredAt_idx" ON "audit_logs"("entityType", "entityId", "occurredAt");
CREATE INDEX "audit_logs_actorUserId_occurredAt_idx" ON "audit_logs"("actorUserId", "occurredAt");

CREATE FUNCTION reject_immutable_phase3_evidence() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "audit_logs_append_only" BEFORE UPDATE OR DELETE ON "audit_logs"
FOR EACH ROW EXECUTE FUNCTION reject_immutable_phase3_evidence();

CREATE TRIGGER "approval_decisions_append_only" BEFORE UPDATE OR DELETE ON "approval_decisions"
FOR EACH ROW EXECUTE FUNCTION reject_immutable_phase3_evidence();

CREATE FUNCTION enforce_maker_checker() RETURNS trigger AS $$
DECLARE
  maker_id UUID;
  maker_checker_required BOOLEAN;
BEGIN
  SELECT request."makerEmployeeId",
         EXISTS (
           SELECT 1 FROM "approval_rules" rule
           WHERE rule."policyId" = request."policyId"
             AND rule."actionType" = request."actionType"
             AND rule."makerChecker" = TRUE
         )
  INTO maker_id, maker_checker_required
  FROM "approval_steps" step
  JOIN "approval_requests" request ON request."id" = step."requestId"
  WHERE step."id" = NEW."stepId";

  IF maker_checker_required AND maker_id = NEW."approverEmployeeId" THEN
    RAISE EXCEPTION 'maker cannot approve own request';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "approval_decisions_maker_checker" BEFORE INSERT ON "approval_decisions"
FOR EACH ROW EXECUTE FUNCTION enforce_maker_checker();
