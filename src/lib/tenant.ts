import { cache } from "react";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";

// proxy.ts resolves the tenant from the request's subdomain (or the
// single-tenant DEFAULT_TENANT_SUBDOMAIN fallback when no custom domain is
// configured yet) and attaches it as the x-tenant-id header before any
// Server Component or Server Action runs — see extractSubdomain in
// src/lib/subdomain.ts and the resolution block in src/proxy.ts.
export const getCurrentTenant = cache(async () => {
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) {
    throw new Error(
      "No x-tenant-id header on this request — proxy.ts should have resolved and attached a tenant before this ran."
    );
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    throw new Error(`x-tenant-id "${tenantId}" doesn't match any tenant.`);
  }

  return tenant;
});
