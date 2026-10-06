import { MAX_LIST_ROWS } from "@/lib/listLimits";
import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { canManageRecruitment } from "@/lib/users";
import { userCanSeeRegions } from "@/lib/regions";
import { RequirementsTable } from "./RequirementsTable";
import { REQUIREMENT_LIST_SELECT, toRequirementListRow, type SubmissionBuckets } from "./types";
import { submissionStatusBucket } from "@/lib/bench";

export const dynamic = "force-dynamic";

export default async function RequirementsPage() {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentUser();
  const db = await getTenantDb();
  const [requirements, statusCounts] = await Promise.all([
    db.requirement.findMany({
      where: { tenantId: tenant.id, deletedAt: null },
      // Slim rows; the full requirement loads when opened (getRequirementDetail).
      select: REQUIREMENT_LIST_SELECT,
      orderBy: { createdAt: "desc" },
      take: MAX_LIST_ROWS,
    }),
    // Submissions per requirement and status, for the count bubbles.
    db.submission.groupBy({
      by: ["requirementId", "status"],
      where: { tenantId: tenant.id, deletedAt: null, requirementId: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const buckets = new Map<string, SubmissionBuckets>();
  for (const row of statusCounts) {
    if (!row.requirementId) continue;
    const b = buckets.get(row.requirementId) ?? { blue: 0, amber: 0, green: 0, red: 0 };
    b[submissionStatusBucket(row.status)] += row._count._all;
    buckets.set(row.requirementId, b);
  }

  // Region restriction (User Management) scopes which requirements a
  // recruiter can even see — mirrors the original's Region multi-select.
  const visible = requirements.filter((r) => userCanSeeRegions(currentUser.regions, r.country));

  return (
    <RequirementsTable
      requirements={visible.map((r) => toRequirementListRow(r, buckets.get(r.id)))}
      currentUserId={currentUser.id}
      canEdit={canManageRecruitment(currentUser.role)}
    />
  );
}
