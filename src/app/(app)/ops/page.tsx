import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuthBypassDb } from "@/lib/tenantDb";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import { OpsTable } from "./OpsTable";
import type { TenantWithStats } from "./types";

export const dynamic = "force-dynamic";

// Platform-wide view across every tenant — not gated by getCurrentTenant()'s
// subdomain resolution the way every other (app) page is. Reads tenants
// (no RLS on that table) plus a cross-tenant user count that deliberately
// goes through the same bypass_rls escape hatch getCurrentUser() uses for
// its own cross-tenant authUserId lookup — see src/lib/tenantDb.ts.
export default async function OpsPage() {
  if (!(await isPlatformAdmin())) {
    redirect("/requirements");
  }

  const [tenants, userCounts] = await Promise.all([
    prisma.tenant.findMany({ orderBy: { createdAt: "desc" } }),
    (await getAuthBypassDb()).user.groupBy({ by: ["tenantId"], _count: { _all: true } }),
  ]);

  const countByTenant = new Map(userCounts.map((c) => [c.tenantId, c._count._all]));
  const rows: TenantWithStats[] = tenants.map((t) => ({
    ...t,
    userCount: countByTenant.get(t.id) ?? 0,
  }));

  return <OpsTable tenants={rows} />;
}
