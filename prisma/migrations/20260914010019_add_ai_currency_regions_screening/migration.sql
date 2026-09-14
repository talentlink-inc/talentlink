-- Hand-written (not `prisma migrate dev`) specifically so the CPOC rename
-- below is a real RENAME COLUMN, not the drop-and-recreate `migrate dev`
-- would have done non-interactively — requirements.cpoc_raw had 37 non-null
-- values at the time this was written.

-- Tenant: AI-assisted parsing config + logo variant
ALTER TABLE "tenants" ADD COLUMN "ai_provider" TEXT NOT NULL DEFAULT 'groq';
ALTER TABLE "tenants" ADD COLUMN "ai_api_key" TEXT;
ALTER TABLE "tenants" ADD COLUMN "logo_style" TEXT NOT NULL DEFAULT 'full';

-- User: region data-scoping restriction
ALTER TABLE "users" ADD COLUMN "regions" TEXT;

-- Requirement: CPOC -> Account Manager rename (preserves existing data)
ALTER TABLE "requirements" RENAME COLUMN "cpoc_user_id" TO "account_manager_user_id";
ALTER TABLE "requirements" RENAME COLUMN "cpoc_raw" TO "account_manager_raw";

-- Requirement: currency, screening questions, public apply link
ALTER TABLE "requirements" ADD COLUMN "bill_rate_currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "requirements" ADD COLUMN "pay_rate_currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "requirements" ADD COLUMN "screening_questions" JSONB;
ALTER TABLE "requirements" ADD COLUMN "public_apply_token" TEXT;
CREATE UNIQUE INDEX "requirements_public_apply_token_key" ON "requirements"("public_apply_token");

-- Submission: currency, screening answers
ALTER TABLE "submissions" ADD COLUMN "bill_rate_currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "submissions" ADD COLUMN "pay_rate_currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "submissions" ADD COLUMN "screening_answers" JSONB;
