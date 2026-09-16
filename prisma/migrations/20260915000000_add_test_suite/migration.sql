-- CreateTable
CREATE TABLE "test_cases" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "definition" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_status" TEXT,
    "last_run_message" TEXT,
    "last_run_at" TIMESTAMP(3),
    "last_run_duration_ms" INTEGER,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_run_batches" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "triggered_by_user_id" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "pass_count" INTEGER NOT NULL DEFAULT 0,
    "fail_count" INTEGER NOT NULL DEFAULT 0,
    "results" JSONB NOT NULL,

    CONSTRAINT "test_run_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable — deliberately no tenant_id: a CI run covers the one shared
-- codebase every tenant runs on, same reasoning as the `tenants` table
-- itself (see its closing comment in schema.prisma). Read via the plain
-- `prisma` client, never getTenantDb().
CREATE TABLE "ci_suite_snapshots" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "pass_count" INTEGER NOT NULL,
    "fail_count" INTEGER NOT NULL,
    "total_count" INTEGER NOT NULL,
    "commit_sha" TEXT,
    "run_url" TEXT,
    "details" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ci_suite_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "test_cases_tenant_id_category_idx" ON "test_cases"("tenant_id", "category");

-- CreateIndex
CREATE INDEX "test_run_batches_tenant_id_started_at_idx" ON "test_run_batches"("tenant_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "ci_suite_snapshots_category_key" ON "ci_suite_snapshots"("category");

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_run_batches" ADD CONSTRAINT "test_run_batches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_run_batches" ADD CONSTRAINT "test_run_batches_triggered_by_user_id_fkey" FOREIGN KEY ("triggered_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row-Level Security — same pattern as the rest of the app (see
-- 20260905120000_add_row_level_security for the full rationale). Both new
-- tenant-scoped tables get FORCE ROW LEVEL SECURITY so this holds even
-- against the DB's owning role, not just ordinary querents.
ALTER TABLE "test_cases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "test_cases" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "test_cases"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "test_run_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "test_run_batches" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "test_run_batches"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- ci_suite_snapshots is intentionally NOT given a tenant-scoped RLS policy —
-- it holds no tenant_id column at all (see the CreateTable comment above).
