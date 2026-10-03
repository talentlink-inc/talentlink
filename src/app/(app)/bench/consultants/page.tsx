import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { canDeleteAnyBenchConsultant } from "@/lib/users";
import { MAX_LIST_ROWS } from "@/lib/listLimits";
import { ConsultantsTable } from "./ConsultantsTable";
import { serializeConsultant } from "./types";

export const dynamic = "force-dynamic";

export default async function BenchConsultantsPage() {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentUser();
  const db = await getTenantDb();
  const consultants = await db.benchConsultant.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    include: { _count: { select: { submissions: { where: { deletedAt: null } } } } },
    orderBy: { addedDate: "desc" },
    take: MAX_LIST_ROWS,
  });

  return (
    <ConsultantsTable
      consultants={consultants.map(serializeConsultant)}
      currentUser={{
        id: currentUser.id,
        name: currentUser.name,
        canDeleteAny: canDeleteAnyBenchConsultant(currentUser.role),
        canViewResume: currentUser.canViewResume,
        canDownloadResume: currentUser.canDownloadResume,
      }}
    />
  );
}
