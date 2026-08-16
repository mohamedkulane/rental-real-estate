CREATE TABLE "user_permission_overrides" (
  "userId" UUID NOT NULL,
  "permissionId" UUID NOT NULL,
  "allowed" BOOLEAN NOT NULL,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "user_permission_overrides_pkey" PRIMARY KEY ("userId", "permissionId"),
  CONSTRAINT "user_permission_overrides_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "user_permission_overrides_permissionId_fkey"
    FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX "user_permission_overrides_permissionId_idx"
  ON "user_permission_overrides"("permissionId");