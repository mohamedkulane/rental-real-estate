ALTER TABLE "workflow_canonical_references" ADD COLUMN "expectedFingerprint" VARCHAR(64);

CREATE TABLE "workflow_commands" (
  "id" UUID PRIMARY KEY,
  "workflowId" UUID NOT NULL REFERENCES "workflow_drafts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  "callerUserId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  "command" VARCHAR(30) NOT NULL,
  "idempotencyKey" VARCHAR(120) NOT NULL,
  "requestHash" CHAR(64) NOT NULL,
  "entityId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "uq_workflow_command_idempotency" UNIQUE ("workflowId", "callerUserId", "idempotencyKey")
);
