import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { RequirementsTable } from "./RequirementsTable";
import { serializeRequirement } from "./types";

export const dynamic = "force-dynamic";

export default async function RequirementsPage() {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentUser();
  const requirements = await prisma.requirement.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <RequirementsTable
      requirements={requirements.map(serializeRequirement)}
      currentUserId={currentUser.id}
    />
  );
}
