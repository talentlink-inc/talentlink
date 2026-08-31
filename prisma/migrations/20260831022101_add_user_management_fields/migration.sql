-- AlterTable
ALTER TABLE "users" ADD COLUMN     "can_download_resume" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "can_view_email" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "can_view_phone" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "can_view_resume" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "phone" TEXT;
