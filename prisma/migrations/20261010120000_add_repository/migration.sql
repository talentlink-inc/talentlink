-- Repository: GAS Resume Lab resumes, verified and merged into one pool.
ALTER TABLE "candidates"
  ADD COLUMN "in_repository" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "current_title" TEXT,
  ADD COLUMN "skills" TEXT,
  ADD COLUMN "country" TEXT,
  ADD COLUMN "repository_received_at" TIMESTAMP(3),
  ADD COLUMN "repository_added_by" TEXT,
  ADD COLUMN "repository_legacy_id" TEXT;

CREATE UNIQUE INDEX "candidates_tenant_id_repository_legacy_id_key" ON "candidates"("tenant_id", "repository_legacy_id");
CREATE INDEX "candidates_tenant_id_in_repository_repository_received_at_idx" ON "candidates"("tenant_id", "in_repository", "repository_received_at");
