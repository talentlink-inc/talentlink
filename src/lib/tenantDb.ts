import { cache } from "react";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";

// Second layer of tenant isolation, underneath the existing app-level
// `where: { tenantId }` filtering: every tenant-scoped table has a Postgres
// Row-Level Security policy that only allows access to rows matching the
// `app.tenant_id` session setting. If a query anywhere ever forgets its
// tenantId filter, RLS still blocks it at the database — see
// prisma/migrations/*_add_row_level_security for the policies themselves.
//
// The tricky part is PgBouncer's transaction-pooling mode (DATABASE_URL):
// a connection can be handed to a different request between queries, so a
// plain `SET` would leak one tenant's context into another's request. The
// fix (Prisma's own documented pattern — see
// github.com/prisma/prisma-client-extensions/tree/main/row-level-security)
// is `set_config(..., true)` — the `true` is `is_local`, equivalent to
// `SET LOCAL` — run inside the SAME batch transaction as the real query via
// `prisma.$transaction([setConfig, query(args)])`. Both statements are then
// guaranteed to run on one connection, and the setting reverts automatically
// when that transaction ends, so it can never bleed into the next request
// that borrows the same pooled connection.
function scopedClient(configSql: Prisma.Sql) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, result] = await prisma.$transaction([
            prisma.$executeRaw(configSql),
            query(args),
          ]);
          return result;
        },
      },
    },
  });
}

// Use for every query against tenant-scoped tables (Requirement, Candidate,
// Resume, Submission, Interview, Note, User, CalendarIntegration) from
// Server Components, Server Actions, and Route Handlers. Cached per request
// like getCurrentTenant() itself.
export const getTenantDb = cache(async () => {
  const tenant = await getCurrentTenant();
  return getTenantDbFor(tenant.id);
});

// For code that already carries an explicit tenantId rather than running
// inside a request that's resolved getCurrentTenant() itself — e.g.
// src/lib/calendarIntegration.ts, whose functions take tenantId as a plain
// parameter. Not cached, since a caller may legitimately need it for a
// tenant other than the current request's (there is none here, but the
// distinction matters for correctness, not just style).
export function getTenantDbFor(tenantId: string) {
  return scopedClient(Prisma.sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`);
}

// The one legitimate cross-tenant lookup in the app: resolving a Supabase
// authUserId to its `users` row in getCurrentUser(), before we know whether
// that user even belongs to the tenant the subdomain resolved to (that's
// exactly the mismatch getCurrentUser() checks for afterward). The `users`
// RLS policy has a matching `current_setting('app.bypass_rls', true) = 'on'`
// clause that ONLY this helper ever sets — never expose it based on request
// input.
export const getAuthBypassDb = cache(async () => {
  return scopedClient(Prisma.sql`SELECT set_config('app.bypass_rls', 'on', true)`);
});
