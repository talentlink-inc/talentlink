import { redirect } from "next/navigation";
import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { canManageUsers, canViewUsers } from "@/lib/users";
import { UsersTable } from "./UsersTable";
import { PageHeader } from "@/components/ui/PageHeader";

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
    <>
      <PageHeader title="User Management" subtitle="Who can sign in, and what they can see" />
      <UsersTable
        users={users}
        currentUserId={currentUser.id}
        canEdit={canManageUsers(currentUser.role)}
      />
    </>
  );
}
