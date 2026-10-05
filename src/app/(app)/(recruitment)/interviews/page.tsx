import { MAX_LIST_ROWS } from "@/lib/listLimits";
import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { INTERVIEW_ELIGIBLE_SUBMISSION_STATUSES } from "@/lib/recruitment";
import { canManageRecruitment, canManageUsers } from "@/lib/users";
import { InterviewsTable } from "./InterviewsTable";
import { INTERVIEW_SUBMISSION_SELECT, serializeInterview } from "./types";
import { getIntegrationStatus } from "./integration-actions";

export const dynamic = "force-dynamic";

export default async function InterviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ integration_connected?: string; integration_error?: string }>;
}) {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentUser();
  const params = await searchParams;
  const canManageIntegration = canManageUsers(currentUser.role);
  const db = await getTenantDb();

  const [interviews, eligibleSubmissions, integrationStatus] = await Promise.all([
    db.interview.findMany({
      where: { tenantId: tenant.id, deletedAt: null },
      include: { submission: { select: INTERVIEW_SUBMISSION_SELECT } },
      orderBy: { scheduledAt: "desc" },
      take: MAX_LIST_ROWS,
    }),
    db.submission.findMany({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        status: { in: [...INTERVIEW_ELIGIBLE_SUBMISSION_STATUSES] },
      },
      select: INTERVIEW_SUBMISSION_SELECT,
      orderBy: { submissionDate: "desc" },
    }),
    canManageIntegration ? getIntegrationStatus() : Promise.resolve(null),
  ]);

  return (
    <InterviewsTable
      // Only names and titles are sent — no candidate contact details to redact.
      interviews={interviews.map(serializeInterview)}
      eligibleSubmissions={eligibleSubmissions}
      currentUserId={currentUser.id}
      canEdit={canManageRecruitment(currentUser.role)}
      canManageIntegration={canManageIntegration}
      integrationStatus={integrationStatus}
      integrationConnected={params.integration_connected === "1"}
      integrationError={params.integration_error ?? null}
    />
  );
}
