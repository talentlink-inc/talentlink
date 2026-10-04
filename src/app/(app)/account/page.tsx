import { getCurrentUser } from "@/lib/auth";
import { getMfaStatus } from "./actions";
import { AccountSecurity } from "./AccountSecurity";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const currentUser = await getCurrentUser();
  const mfa = await getMfaStatus();

  return (
    <>
      <PageHeader title="My Account" subtitle="Your profile and sign-in security" />
      <div className="max-w-2xl">
        <div className="mb-6 rounded-lg border border-black/10 border-t-[3px] border-t-brand bg-white p-4 shadow-sm dark:border-white/10 dark:bg-neutral-950">
          <div className="mb-3">
            <p className="text-xs text-black/50 dark:text-white/50">Name</p>
            <p className="text-sm">{currentUser.name}</p>
          </div>
          <div className="mb-3">
            <p className="text-xs text-black/50 dark:text-white/50">Email</p>
            <p className="text-sm">{currentUser.email}</p>
          </div>
          <div>
            <p className="text-xs text-black/50 dark:text-white/50">Role</p>
            <p className="text-sm">{currentUser.role}</p>
          </div>
        </div>

        <AccountSecurity initialEnrolled={mfa.enrolled} initialFactorId={mfa.factorId} />
      </div>
    </>
  );
}
