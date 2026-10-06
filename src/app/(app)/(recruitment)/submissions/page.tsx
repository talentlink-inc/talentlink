import { MAX_LIST_ROWS } from "@/lib/listLimits";
import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { canManageRecruitment, canManageUsers } from "@/lib/users";
import { inRange, nowWindows } from "@/lib/insights";
import { SubmissionsTable } from "./SubmissionsTable";
import { REQUIREMENT_SUMMARY_SELECT, SUBMISSION_LIST_SELECT, toSubmissionListRow } from "./types";

export const dynamic = "force-dynamic";

export default async function SubmissionsPage() {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentUser();
  const db = await getTenantDb();
  const [submissions, requirements] = await Promise.all([
    db.submission.findMany({
      where: { tenantId: tenant.id, deletedAt: null },
      select: SUBMISSION_LIST_SELECT,
      orderBy: { submissionDate: "desc" },
      take: MAX_LIST_ROWS,
    }),
    db.requirement.findMany({
      where: { tenantId: tenant.id, deletedAt: null },
      select: REQUIREMENT_SUMMARY_SELECT,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Stat cards (business timezone, same windows as Insights).
  const { today, week } = nowWindows(new Date());
  const stats = {
    total: submissions.length,
    today: submissions.filter((s) => inRange(s.submissionDate, today.start, today.end)).length,
    week: submissions.filter((s) => inRange(s.submissionDate, week.start, week.end)).length,
    withResume: submissions.filter((s) => s.resume).length,
  };

  return (
    <SubmissionsTable
      stats={stats}
      submissions={submissions.map((s) => toSubmissionListRow(s, currentUser))}
      requirements={requirements}
      currentUserId={currentUser.id}
      canEdit={canManageRecruitment(currentUser.role)}
      isAdmin={canManageUsers(currentUser.role)}
      permissions={{
        canViewResume: currentUser.canViewResume,
        canDownloadResume: currentUser.canDownloadResume,
        canViewPhone: currentUser.canViewPhone,
        canViewEmail: currentUser.canViewEmail,
      }}
    />
  );
}
