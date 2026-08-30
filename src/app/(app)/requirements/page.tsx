import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { RequirementsTable } from "./RequirementsTable";

export const dynamic = "force-dynamic";

export default async function RequirementsPage() {
  const tenant = await getCurrentTenant();
  const requirements = await prisma.requirement.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return <RequirementsTable requirements={requirements} />;
}
