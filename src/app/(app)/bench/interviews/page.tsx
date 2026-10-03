import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { canDeleteAnyBenchConsultant } from "@/lib/users";
import { MAX_LIST_ROWS } from "@/lib/listLimits";
import { BENCH_INTERVIEW_ELIGIBLE_STATUSES } from "@/lib/bench";
import { BenchInterviewsTable } from "./BenchInterviewsTable";
import { BENCH_CONSULTANT_SUMMARY_SELECT } from "../submissions/types";

export const dynamic = "force-dynamic";

const SUBMISSION_PICK = {
  id: true,
  submissionCode: true,
  companyName: true,
  status: true,
  consultant: { select: BENCH_CONSULTANT_SUMMARY_SELECT },
} as const;

export default async function BenchInterviewsPage() {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentUser();
  const db = await getTenantDb();
  const [interviews, eligibleSubmissions] = await Promise.all([
    db.benchInterview.findMany({
      where: { tenantId: tenant.id, deletedAt: null },
      include: { submission: { select: SUBMISSION_PICK } },
      orderBy: { scheduledAt: "desc" },
      take: MAX_LIST_ROWS,
    }),
    db.benchSubmission.findMany({
      where: { tenantId: tenant.id, deletedAt: null, status: { in: [...BENCH_INTERVIEW_ELIGIBLE_STATUSES] } },
      select: SUBMISSION_PICK,
      orderBy: { submissionDate: "desc" },
    }),
  ]);

  return (
    <BenchInterviewsTable
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      interviews={interviews.map(({ tenantId, ...rest }) => rest)}
      eligibleSubmissions={eligibleSubmissions}
      currentUser={{ id: currentUser.id, name: currentUser.name, canDeleteAny: canDeleteAnyBenchConsultant(currentUser.role) }}
    />
  );
}
