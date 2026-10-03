-- CreateTable
CREATE TABLE "bench_consultants" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "legacy_id" INTEGER,
    "consultant_code" TEXT NOT NULL,
    "consultant_name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "technology_skills" TEXT NOT NULL,
    "visa_status" TEXT NOT NULL,
    "relocation" TEXT NOT NULL DEFAULT 'No',
    "experience" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "availability" TEXT NOT NULL,
    "pay_rate" TEXT,
    "marketing_rate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Available',
    "linkedin_url" TEXT,
    "marketer_user_id" TEXT,
    "marketer_name_raw" TEXT,
    "assigned_to_user_id" TEXT,
    "assigned_to_name_raw" TEXT,
    "on_hotlist" BOOLEAN NOT NULL DEFAULT false,
    "hotlist_status" TEXT,
    "resume_file_url" TEXT,
    "resume_file_name" TEXT,
    "resume_file_mime" TEXT,
    "resume_source_drive_file_id" TEXT,
    "added_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "bench_consultants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bench_submissions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "legacy_id" INTEGER,
    "submission_code" TEXT NOT NULL,
    "bench_consultant_id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "contact_person" TEXT,
    "contact_number" TEXT,
    "email" TEXT,
    "rate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Vender_Submission',
    "reject_reason" TEXT,
    "notes" TEXT,
    "submitted_by_user_id" TEXT,
    "submitted_by_name_raw" TEXT,
    "submission_date" TIMESTAMP(3),
    "placement_id" TEXT,
    "selected_date" TIMESTAMP(3),
    "doj" TIMESTAMP(3),
    "bill_rate" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "bench_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bench_interviews" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "legacy_id" INTEGER,
    "bench_submission_id" TEXT NOT NULL,
    "interview_type" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3),
    "timezone" TEXT,
    "duration_minutes" INTEGER,
    "mode" TEXT,
    "client_company" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Scheduled',
    "feedback" TEXT,
    "scheduled_by_user_id" TEXT,
    "scheduled_by_name_raw" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "bench_interviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bench_consultants_tenant_id_status_idx" ON "bench_consultants"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "bench_consultants_tenant_id_legacy_id_key" ON "bench_consultants"("tenant_id", "legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "bench_consultants_tenant_id_consultant_code_key" ON "bench_consultants"("tenant_id", "consultant_code");

-- CreateIndex
CREATE INDEX "bench_submissions_tenant_id_bench_consultant_id_idx" ON "bench_submissions"("tenant_id", "bench_consultant_id");

-- CreateIndex
CREATE INDEX "bench_submissions_tenant_id_status_idx" ON "bench_submissions"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "bench_submissions_tenant_id_legacy_id_key" ON "bench_submissions"("tenant_id", "legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "bench_submissions_tenant_id_submission_code_key" ON "bench_submissions"("tenant_id", "submission_code");

-- CreateIndex
CREATE UNIQUE INDEX "bench_submissions_tenant_id_placement_id_key" ON "bench_submissions"("tenant_id", "placement_id");

-- CreateIndex
CREATE INDEX "bench_interviews_tenant_id_bench_submission_id_idx" ON "bench_interviews"("tenant_id", "bench_submission_id");

-- CreateIndex
CREATE INDEX "bench_interviews_tenant_id_status_idx" ON "bench_interviews"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "bench_interviews_tenant_id_legacy_id_key" ON "bench_interviews"("tenant_id", "legacy_id");

-- AddForeignKey
ALTER TABLE "bench_consultants" ADD CONSTRAINT "bench_consultants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bench_consultants" ADD CONSTRAINT "bench_consultants_marketer_user_id_fkey" FOREIGN KEY ("marketer_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bench_consultants" ADD CONSTRAINT "bench_consultants_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bench_submissions" ADD CONSTRAINT "bench_submissions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bench_submissions" ADD CONSTRAINT "bench_submissions_bench_consultant_id_fkey" FOREIGN KEY ("bench_consultant_id") REFERENCES "bench_consultants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bench_submissions" ADD CONSTRAINT "bench_submissions_submitted_by_user_id_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bench_interviews" ADD CONSTRAINT "bench_interviews_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bench_interviews" ADD CONSTRAINT "bench_interviews_bench_submission_id_fkey" FOREIGN KEY ("bench_submission_id") REFERENCES "bench_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bench_interviews" ADD CONSTRAINT "bench_interviews_scheduled_by_user_id_fkey" FOREIGN KEY ("scheduled_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Row-Level Security — same tenant_isolation policy as every other
-- tenant-scoped table (see 20260905120000_add_row_level_security). FORCE so
-- it holds even for the owning role; fails closed when app.tenant_id isn't
-- set. Table grants for the app role come from the schema's default
-- privileges (scripts/check-rls-role.ts), as with 20260915000000_add_test_suite.
ALTER TABLE "bench_consultants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bench_consultants" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "bench_consultants"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "bench_submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bench_submissions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "bench_submissions"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "bench_interviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bench_interviews" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "bench_interviews"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
