import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant";
import { getAuthBypassDb } from "@/lib/tenantDb";
import { hasRootDomainConfigured } from "@/lib/subdomain";

// proxy.ts already redirects unauthenticated requests to /login, so any page
// this is called from is guaranteed to have a session — but the matching
// `users` row (role, name, tenant) is a separate lookup by authUserId.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    throw new Error("No authenticated session — this should be unreachable past proxy.ts.");
  }

  // authUserId is looked up before we know which tenant (if any) this
  // session actually belongs to — that's determined by the mismatch check
  // below — so the `users` RLS policy can't be scoped to a tenant here yet.
  // getAuthBypassDb() is the one sanctioned exception to that policy.
  const bypassDb = await getAuthBypassDb();
  const user = await bypassDb.user.findUnique({ where: { authUserId: authUser.id } });
  if (!user) {
    throw new Error(
      `Authenticated as ${authUser.email} but no matching users row (authUserId=${authUser.id}).`
    );
  }

  // An Admin deactivating a user (User Management) should actually end their
  // access, not just relabel them — matching ITStaffing's "force-logs-out on
  // deactivation" behavior.
  if (user.status !== "active") {
    await supabase.auth.signOut();
    redirect("/login?deactivated=1");
  }

  // Supabase Auth identities are global (one authUserId maps to exactly one
  // users row, platform-wide), but proxy.ts resolves the tenant from the
  // *subdomain in the URL* — those two can disagree if someone signed in on
  // one workspace's subdomain and then navigates to another's. Trusting the
  // subdomain alone there would leak this user into a tenant they don't
  // belong to, so cross-check here before any tenant-scoped query runs.
  const tenant = await getCurrentTenant();
  if (user.tenantId !== tenant.id) {
    await supabase.auth.signOut();
    if (hasRootDomainConfigured()) {
      const ownTenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });
      if (ownTenant) {
        redirect(`https://${ownTenant.subdomain}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}/login`);
      }
    }
    redirect("/login?wrong_workspace=1");
  }

  return user;
});
