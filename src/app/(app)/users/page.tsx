import { redirect } from "next/navigation";
import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { canManageUsers, canViewUsers } from "@/lib/users";
import { UsersTable } from "./UsersTable";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const currentUser = await getCurrentUser();
  if (!canViewUsers(currentUser.role)) {
    redirect("/requirements");
  }

  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  const users = await db.user.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <UsersTable
      users={users}
      currentUserId={currentUser.id}
      canEdit={canManageUsers(currentUser.role)}
    />
  );
}
