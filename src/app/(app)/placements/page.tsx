import { MAX_LIST_ROWS } from "@/lib/listLimits";
import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { canManageRecruitment } from "@/lib/users";
import { PlacementsTable } from "./PlacementsTable";
import { REQUIREMENT_SUMMARY_SELECT, redactCandidateContact, serializeSubmission } from "../submissions/types";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

// Placements aren't a separate entity — they're submissions that were ever
// assigned a PlacementID (see QUALIFYING_PLACEMENT_STATUSES / shouldClearPlacementId
// in lib/recruitment.ts). A placement stays listed even after a later reject
// ("fell through"), matching the source app's rule that placement history is
// never silently erased — so the filter is "has a placementId", not "is
// currently in a qualifying status".
export default async function PlacementsPage() {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentUser();
  const db = await getTenantDb();
  const placements = await db.submission.findMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      placementId: { not: null },
    },
    include: { candidate: true, requirement: { select: REQUIREMENT_SUMMARY_SELECT }, resume: true },
    orderBy: { selectedDate: "desc" },
    take: MAX_LIST_ROWS,
  });

  return (
    <>
      <PageHeader title="Placements" subtitle="Selected candidates, start dates and bill rates" />
      <PlacementsTable
        placements={placements.map((p) => redactCandidateContact(serializeSubmission(p), currentUser))}
        currentUserId={currentUser.id}
        canEdit={canManageRecruitment(currentUser.role)}
      />
    </>
  );
}
