import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/users";
import { sanitizeHelpHtml } from "@/lib/sanitizeRichText";
import { HelpCenter } from "./HelpCenter";

export const dynamic = "force-dynamic";

export default async function HelpPage() {
  const tenant = await getCurrentTenant();
  const user = await getCurrentUser();
  const isAdmin = canManageUsers(user.role);
  const db = await getTenantDb();
  const topics = await db.helpTopic.findMany({
    where: { tenantId: tenant.id, ...(isAdmin ? {} : { status: "Active" }) },
    select: { id: true, title: true, content: true, status: true, sortOrder: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  // Content is sanitized on write; sanitize again on the way out so a row
  // written any other way (imports, direct edits) can't carry script.
  return (
    <HelpCenter
      topics={topics.map((t) => ({ ...t, content: sanitizeHelpHtml(t.content) }))}
      isAdmin={isAdmin}
    />
  );
}
