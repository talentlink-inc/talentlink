import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { INTERVIEW_ELIGIBLE_SUBMISSION_STATUSES } from "@/lib/recruitment";
import { canManageRecruitment, canManageUsers } from "@/lib/users";
import { InterviewsTable } from "./InterviewsTable";
import { serializeInterview } from "./types";
import { serializeSubmission } from "../submissions/types";
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
      include: { submission: { include: { candidate: true, requirement: true, resume: true } } },
      orderBy: { scheduledAt: "desc" },
      take: 100,
    }),
    db.submission.findMany({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        status: { in: [...INTERVIEW_ELIGIBLE_SUBMISSION_STATUSES] },
      },
      include: { candidate: true, requirement: true, resume: true },
      orderBy: { submissionDate: "desc" },
    }),
    canManageIntegration ? getIntegrationStatus() : Promise.resolve(null),
  ]);

  return (
    <InterviewsTable
      interviews={interviews.map(serializeInterview)}
      eligibleSubmissions={eligibleSubmissions.map(serializeSubmission)}
      currentUserId={currentUser.id}
      canEdit={canManageRecruitment(currentUser.role)}
      canManageIntegration={canManageIntegration}
      integrationStatus={integrationStatus}
      integrationConnected={params.integration_connected === "1"}
      integrationError={params.integration_error ?? null}
    />
  );
}
