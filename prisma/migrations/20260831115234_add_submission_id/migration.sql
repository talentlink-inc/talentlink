-- AlterTable
ALTER TABLE "submissions" ADD COLUMN "submission_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "submissions_tenant_id_submission_id_key" ON "submissions"("tenant_id", "submission_id");
