import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { MAX_LIST_ROWS } from "@/lib/listLimits";
import { BenchPlacementsTable } from "./BenchPlacementsTable";
import { BENCH_CONSULTANT_SUMMARY_SELECT, serializeBenchSubmission } from "../submissions/types";

export const dynamic = "force-dynamic";

// Bench placements aren't a separate table — they're bench submissions that
// were ever given a BPLC- id (GAS getBenchPlacements). A placement stays
// listed after it falls through, so history isn't silently erased.
export default async function BenchPlacementsPage() {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentUser();
  const db = await getTenantDb();
  const placements = await db.benchSubmission.findMany({
    where: { tenantId: tenant.id, deletedAt: null, placementId: { not: null } },
    include: {
      consultant: { select: BENCH_CONSULTANT_SUMMARY_SELECT },
      _count: { select: { interviews: { where: { deletedAt: null } } } },
    },
    orderBy: { selectedDate: "desc" },
    take: MAX_LIST_ROWS,
  });

  return <BenchPlacementsTable placements={placements.map(serializeBenchSubmission)} currentUserId={currentUser.id} />;
}
