import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { HotlistTable } from "./HotlistTable";

export const dynamic = "force-dynamic";

// GAS Hotlist.js: the hotlist is just the bench consultants flagged
// OnHotlist, each Active or Inactive.
export default async function BenchHotlistPage() {
  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  const consultants = await db.benchConsultant.findMany({
    where: { tenantId: tenant.id, deletedAt: null, onHotlist: true },
    select: {
      id: true,
      consultantCode: true,
      consultantName: true,
      role: true,
      technologySkills: true,
      visaStatus: true,
      relocation: true,
      experience: true,
      location: true,
      availability: true,
      status: true,
      hotlistStatus: true,
      marketerNameRaw: true,
    },
    orderBy: { consultantName: "asc" },
  });

  return <HotlistTable consultants={consultants} companyName={tenant.name} />;
}
