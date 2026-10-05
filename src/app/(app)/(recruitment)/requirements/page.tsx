import { MAX_LIST_ROWS } from "@/lib/listLimits";
import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { canManageRecruitment } from "@/lib/users";
import { userCanSeeRegions } from "@/lib/regions";
import { RequirementsTable } from "./RequirementsTable";
import { REQUIREMENT_LIST_SELECT, toRequirementListRow } from "./types";

export const dynamic = "force-dynamic";

export default async function RequirementsPage() {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentUser();
  const db = await getTenantDb();
  const requirements = await db.requirement.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    // Slim rows; the full requirement loads when opened (getRequirementDetail).
    // country is only for the region check below — not sent to the browser.
    select: { ...REQUIREMENT_LIST_SELECT, country: true },
    orderBy: { createdAt: "desc" },
    take: MAX_LIST_ROWS,
  });

  // Region restriction (User Management) scopes which requirements a
  // recruiter can even see — mirrors the original's Region multi-select.
  const visible = requirements.filter((r) => userCanSeeRegions(currentUser.regions, r.country));

  return (
    <RequirementsTable
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      requirements={visible.map(({ country, ...r }) => toRequirementListRow(r))}
      currentUserId={currentUser.id}
      canEdit={canManageRecruitment(currentUser.role)}
    />
  );
}
