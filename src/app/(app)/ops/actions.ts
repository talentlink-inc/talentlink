"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platformAdmin";

// Tenants has no RLS policy (see the RLS migration's closing comment) — a
// plain prisma call is correct here, not getTenantDb(). What gates this is
// requirePlatformAdmin(), not row-level security.
export async function toggleTenantStatus(tenantId: string): Promise<{ error: string | null }> {
  await requirePlatformAdmin();

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return { error: "Workspace not found." };

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { status: tenant.status === "suspended" ? "active" : "suspended" },
  });

  revalidatePath("/ops");
  return { error: null };
}
