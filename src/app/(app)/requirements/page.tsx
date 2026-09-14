import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { canManageRecruitment } from "@/lib/users";
import { userCanSeeRegions } from "@/lib/regions";
import { RequirementsTable } from "./RequirementsTable";
import { serializeRequirement } from "./types";

export const dynamic = "force-dynamic";

export default async function RequirementsPage() {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentUser();
  const db = await getTenantDb();
  const requirements = await db.requirement.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Region restriction (User Management) scopes which requirements a
  // recruiter can even see — mirrors the original's Region multi-select.
  const visible = requirements.filter((r) => userCanSeeRegions(currentUser.regions, r.country));

  return (
    <RequirementsTable
      requirements={visible.map(serializeRequirement)}
      currentUserId={currentUser.id}
      canEdit={canManageRecruitment(currentUser.role)}
    />
  );
}
