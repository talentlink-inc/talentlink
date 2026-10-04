import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/users";
import { getTenantSettings } from "./actions";
import { SettingsForm } from "./SettingsForm";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const currentUser = await getCurrentUser();
  if (!canManageUsers(currentUser.role)) redirect("/requirements");

  const settings = await getTenantSettings();

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Settings" subtitle="Company-wide preferences" />
      <SettingsForm initialSettings={settings} />
    </div>
  );
}
