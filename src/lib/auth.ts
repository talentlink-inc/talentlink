import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

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

  const user = await prisma.user.findUnique({ where: { authUserId: authUser.id } });
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

  return user;
});
