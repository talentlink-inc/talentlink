import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/users";
import { getTenantSettings } from "./actions";
import { SettingsForm } from "./SettingsForm";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const currentUser = await getCurrentUser();
  if (!canManageUsers(currentUser.role)) redirect("/insights");

  const settings = await getTenantSettings();

  return (
    <>
      <PageHeader title="Settings" subtitle="Company-wide preferences" />
      <div className="max-w-2xl">
        <SettingsForm initialSettings={settings} />
      </div>
    </>
  );
}
