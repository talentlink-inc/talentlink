import { cache } from "react";
import { prisma } from "@/lib/db";

// Phase 1 is single-tenant: no subdomain routing yet. This resolves the one
// tenant row created by prisma/seed.ts. When a second tenant is onboarded,
// swap this for subdomain resolution in proxy.ts.
export const getCurrentTenant = cache(async () => {
  const subdomain = process.env.DEFAULT_TENANT_SUBDOMAIN ?? "digitallinks";
  const tenant = await prisma.tenant.findUnique({ where: { subdomain } });
  if (!tenant) {
    throw new Error(
      `No tenant with subdomain "${subdomain}" — run \`npx prisma db seed\` first.`
    );
  }
  return tenant;
});
