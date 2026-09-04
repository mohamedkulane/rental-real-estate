CREATE TYPE "WorkflowType" AS ENUM ('PROPERTY_ONBOARDING', 'RENTAL_BROKERAGE', 'FULL_MANAGEMENT', 'PROPERTY_SALE');
CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'READY_TO_COMPLETE', 'COMPLETING', 'COMPLETED', 'FAILED', 'CANCELLED');

CREATE TABLE "workflow_drafts" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "creatorUserId" UUID NOT NULL,
  "type" "WorkflowType" NOT NULL,
  "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
  "currentStep" INTEGER NOT NULL DEFAULT 1,
  "version" INTEGER NOT NULL DEFAULT 1,
  "payloadSchemaVersion" INTEGER NOT NULL DEFAULT 1,
  "payloadCiphertext" TEXT NOT NULL,
  "completedAt" TIMESTAMPTZ(6),
  "cancelledAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workflow_drafts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workflow_drafts_step_check" CHECK ("currentStep" BETWEEN 1 AND 8),
  CONSTRAINT "workflow_drafts_version_check" CHECK ("version" > 0)
);

CREATE TABLE "workflow_canonical_references" (
  "id" UUID NOT NULL,
  "workflowId" UUID NOT NULL,
  "entityType" VARCHAR(50) NOT NULL,
  "entityId" UUID NOT NULL,
  "step" INTEGER NOT NULL,
  "expectedVersion" INTEGER,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workflow_canonical_references_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workflow_reference_step_check" CHECK ("step" BETWEEN 1 AND 8)
);

CREATE TABLE "workflow_completions" (
  "id" UUID NOT NULL,
  "workflowId" UUID NOT NULL,
  "callerUserId" UUID NOT NULL,
  "idempotencyKey" VARCHAR(120) NOT NULL,
  "requestHash" CHAR(64) NOT NULL,
  "result" JSONB NOT NULL,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workflow_completions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "workflow_draft_scope_status_idx" ON "workflow_drafts"("companyId", "branchId", "status", "updatedAt" DESC, "id" DESC);
CREATE INDEX "workflow_draft_creator_status_idx" ON "workflow_drafts"("creatorUserId", "status", "updatedAt" DESC);
CREATE UNIQUE INDEX "uq_workflow_canonical_reference" ON "workflow_canonical_references"("workflowId", "entityType", "entityId");
CREATE INDEX "workflow_reference_entity_idx" ON "workflow_canonical_references"("entityType", "entityId");
CREATE UNIQUE INDEX "uq_workflow_completion_idempotency" ON "workflow_completions"("workflowId", "callerUserId", "idempotencyKey");
CREATE INDEX "workflow_completion_expiry_idx" ON "workflow_completions"("expiresAt");

ALTER TABLE "workflow_drafts" ADD CONSTRAINT "workflow_drafts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "workflow_drafts" ADD CONSTRAINT "workflow_drafts_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "workflow_drafts" ADD CONSTRAINT "workflow_drafts_creatorUserId_fkey" FOREIGN KEY ("creatorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "workflow_canonical_references" ADD CONSTRAINT "workflow_canonical_references_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflow_drafts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "workflow_completions" ADD CONSTRAINT "workflow_completions_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflow_drafts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "workflow_completions" ADD CONSTRAINT "workflow_completions_callerUserId_fkey" FOREIGN KEY ("callerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
