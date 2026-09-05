import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { canManageRecruitment } from "@/lib/users";
import { SubmissionsTable } from "./SubmissionsTable";
import { serializeSubmission } from "./types";
import { serializeRequirement } from "../requirements/types";

export const dynamic = "force-dynamic";

export default async function SubmissionsPage() {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentUser();
  const db = await getTenantDb();
  const [submissions, requirements] = await Promise.all([
    db.submission.findMany({
      where: { tenantId: tenant.id, deletedAt: null },
      include: { candidate: true, requirement: true, resume: true },
      orderBy: { submissionDate: "desc" },
      take: 100,
    }),
    db.requirement.findMany({
      where: { tenantId: tenant.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <SubmissionsTable
      submissions={submissions.map(serializeSubmission)}
      requirements={requirements.map(serializeRequirement)}
      currentUserId={currentUser.id}
      canEdit={canManageRecruitment(currentUser.role)}
      permissions={{
        canViewResume: currentUser.canViewResume,
        canDownloadResume: currentUser.canDownloadResume,
        canViewPhone: currentUser.canViewPhone,
        canViewEmail: currentUser.canViewEmail,
      }}
    />
  );
}
