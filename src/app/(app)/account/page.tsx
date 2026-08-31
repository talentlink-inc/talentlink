import { getCurrentUser } from "@/lib/auth";
import { getMfaStatus } from "./actions";
import { AccountSecurity } from "./AccountSecurity";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const currentUser = await getCurrentUser();
  const mfa = await getMfaStatus();

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-xl font-semibold">My Account</h1>

      <div className="mb-6 rounded-lg border border-black/10 p-4 dark:border-white/10">
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
  );
}
