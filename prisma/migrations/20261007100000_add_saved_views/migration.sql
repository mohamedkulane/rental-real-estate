CREATE TABLE "saved_views" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "workspace" VARCHAR(80) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "filters" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "saved_views_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "saved_views_companyId_fkey" FOREIGN KEY ("companyId")
    REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "saved_views_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX "uq_saved_view_user_workspace_name"
  ON "saved_views"("userId", "workspace", "name");

CREATE INDEX "saved_view_workspace_idx"
  ON "saved_views"("companyId", "userId", "workspace", "updatedAt" DESC);
