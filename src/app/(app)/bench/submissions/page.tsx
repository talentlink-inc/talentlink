import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { canDeleteAnyBenchConsultant } from "@/lib/users";
import { MAX_LIST_ROWS } from "@/lib/listLimits";
import { BenchSubmissionsTable } from "./BenchSubmissionsTable";
import { BENCH_CONSULTANT_SUMMARY_SELECT, serializeBenchSubmission } from "./types";

export const dynamic = "force-dynamic";

export default async function BenchSubmissionsPage() {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentUser();
  const db = await getTenantDb();
  const [submissions, consultants] = await Promise.all([
    db.benchSubmission.findMany({
      where: { tenantId: tenant.id, deletedAt: null },
      include: {
        consultant: { select: BENCH_CONSULTANT_SUMMARY_SELECT },
        _count: { select: { interviews: { where: { deletedAt: null } } } },
      },
      orderBy: { submissionDate: "desc" },
      take: MAX_LIST_ROWS,
    }),
    db.benchConsultant.findMany({
      where: { tenantId: tenant.id, deletedAt: null },
      select: BENCH_CONSULTANT_SUMMARY_SELECT,
      orderBy: { consultantName: "asc" },
    }),
  ]);

  return (
    <BenchSubmissionsTable
      submissions={submissions.map(serializeBenchSubmission)}
      consultants={consultants}
      currentUserId={currentUser.id}
      canDelete={canDeleteAnyBenchConsultant(currentUser.role)}
    />
  );
}
