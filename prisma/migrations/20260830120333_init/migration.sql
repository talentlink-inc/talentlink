-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'starter',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "auth_user_id" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "legacy_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirements" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "legacy_id" INTEGER,
    "job_id" TEXT NOT NULL,
    "job_title" TEXT NOT NULL,
    "job_description" TEXT,
    "duration" TEXT,
    "visa" TEXT,
    "mandatory_skills" TEXT,
    "work_location" TEXT,
    "bill_rate" DECIMAL(10,2),
    "pay_rate" DECIMAL(10,2),
    "client_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "employment_type" TEXT,
    "country" TEXT,
    "is_remote" BOOLEAN NOT NULL DEFAULT false,
    "regions" JSONB,
    "ceipal_job_id" TEXT,
    "posted_by_user_id" TEXT,
    "posted_by_raw" TEXT,
    "cpoc_user_id" TEXT,
    "cpoc_raw" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_assignees" (
    "requirement_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "requirement_assignees_pkey" PRIMARY KEY ("requirement_id","user_id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "legacy_id" INTEGER,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "current_location" TEXT,
    "total_experience_years" DECIMAL(4,1),
    "visa_status" TEXT,
    "linkedin_url" TEXT,
    "identity_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resumes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT,
    "file_mime" TEXT,
    "file_size_bytes" INTEGER,
    "file_sha256" TEXT,
    "source_drive_file_id" TEXT,
    "parsed_text" TEXT,
    "source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "resumes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "legacy_id" INTEGER,
    "candidate_id" TEXT NOT NULL,
    "resume_id" TEXT,
    "requirement_id" TEXT,
    "requirement_job_id_raw" TEXT,
    "role_with_skills" TEXT,
    "role_skills_short" TEXT,
    "status" TEXT NOT NULL DEFAULT 'New_Resume',
    "employment_type" TEXT,
    "country" TEXT,
    "recruiter_user_id" TEXT,
    "recruiter_name_raw" TEXT,
    "assigned_to_user_id" TEXT,
    "assigned_to_name_raw" TEXT,
    "cpoc_user_id" TEXT,
    "cpoc_name_raw" TEXT,
    "sales_by" TEXT,
    "submission_date" TIMESTAMP(3),
    "submission_count_date" TIMESTAMP(3),
    "selected_date" TIMESTAMP(3),
    "doj" TIMESTAMP(3),
    "bill_rate" DECIMAL(10,2),
    "pay_rate" DECIMAL(10,2),
    "commission" DECIMAL(10,2),
    "placement_id" TEXT,
    "reject_reason" TEXT,
    "additional_doc_url" TEXT,
    "additional_doc_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interviews" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "legacy_id" INTEGER,
    "submission_id" TEXT NOT NULL,
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
    "outlook_event_id" TEXT,
    "info_alert_event_ids" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "interviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_subdomain_key" ON "tenants"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_user_id_key" ON "users"("auth_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "requirements_tenant_id_status_idx" ON "requirements"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "requirements_tenant_id_job_id_key" ON "requirements"("tenant_id", "job_id");

-- CreateIndex
CREATE INDEX "candidates_tenant_id_email_idx" ON "candidates"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "candidates_tenant_id_phone_idx" ON "candidates"("tenant_id", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_tenant_id_identity_hash_key" ON "candidates"("tenant_id", "identity_hash");

-- CreateIndex
CREATE INDEX "resumes_tenant_id_file_sha256_idx" ON "resumes"("tenant_id", "file_sha256");

-- CreateIndex
CREATE INDEX "submissions_tenant_id_requirement_id_idx" ON "submissions"("tenant_id", "requirement_id");

-- CreateIndex
CREATE INDEX "submissions_tenant_id_status_idx" ON "submissions"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "submissions_tenant_id_placement_id_idx" ON "submissions"("tenant_id", "placement_id");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_tenant_id_legacy_id_key" ON "submissions"("tenant_id", "legacy_id");

-- CreateIndex
CREATE INDEX "interviews_tenant_id_submission_id_idx" ON "interviews"("tenant_id", "submission_id");

-- CreateIndex
CREATE INDEX "interviews_tenant_id_status_idx" ON "interviews"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "interviews_tenant_id_legacy_id_key" ON "interviews"("tenant_id", "legacy_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_posted_by_user_id_fkey" FOREIGN KEY ("posted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_cpoc_user_id_fkey" FOREIGN KEY ("cpoc_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_assignees" ADD CONSTRAINT "requirement_assignees_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_assignees" ADD CONSTRAINT "requirement_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resumes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_recruiter_user_id_fkey" FOREIGN KEY ("recruiter_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_cpoc_user_id_fkey" FOREIGN KEY ("cpoc_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_scheduled_by_user_id_fkey" FOREIGN KEY ("scheduled_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
