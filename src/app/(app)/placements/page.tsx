import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { PlacementsTable } from "./PlacementsTable";
import { serializeSubmission } from "../submissions/types";

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
  const placements = await prisma.submission.findMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      placementId: { not: null },
    },
    include: { candidate: true, requirement: true, resume: true },
    orderBy: { selectedDate: "desc" },
    take: 100,
  });

  return (
    <PlacementsTable placements={placements.map(serializeSubmission)} currentUserId={currentUser.id} />
  );
}
