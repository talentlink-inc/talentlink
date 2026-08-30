import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { INTERVIEW_ELIGIBLE_SUBMISSION_STATUSES } from "@/lib/recruitment";
import { InterviewsTable } from "./InterviewsTable";
import { serializeInterview } from "./types";
import { serializeSubmission } from "../submissions/types";

export const dynamic = "force-dynamic";

export default async function InterviewsPage() {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentUser();
  const [interviews, eligibleSubmissions] = await Promise.all([
    prisma.interview.findMany({
      where: { tenantId: tenant.id, deletedAt: null },
      include: { submission: { include: { candidate: true, requirement: true, resume: true } } },
      orderBy: { scheduledAt: "desc" },
      take: 100,
    }),
    prisma.submission.findMany({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        status: { in: [...INTERVIEW_ELIGIBLE_SUBMISSION_STATUSES] },
      },
      include: { candidate: true, requirement: true, resume: true },
      orderBy: { submissionDate: "desc" },
    }),
  ]);

  return (
    <InterviewsTable
      interviews={interviews.map(serializeInterview)}
      eligibleSubmissions={eligibleSubmissions.map(serializeSubmission)}
      currentUserId={currentUser.id}
    />
  );
}
