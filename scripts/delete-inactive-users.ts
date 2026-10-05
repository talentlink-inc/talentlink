// One-off cleanup: deletes inactive user accounts (leftovers from automated
// test runs against production) and their Supabase Auth logins. A user who
// still owns records is skipped and reported, same rule as the app's Delete
// button (users/actions.ts deleteUser).
//
// Usage: npx tsx scripts/delete-inactive-users.ts [--dry-run]

import "dotenv/config";
import { prisma } from "../src/lib/db";
import { getTenantDbFor } from "../src/lib/tenantDb";
import { getSupabaseAdmin } from "../src/lib/supabase/admin";

const DRY_RUN = process.argv.includes("--dry-run");
const TENANT_SUBDOMAIN = process.env.DEFAULT_TENANT_SUBDOMAIN ?? "digitallinks";

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { subdomain: TENANT_SUBDOMAIN } });
  if (!tenant) throw new Error(`No tenant "${TENANT_SUBDOMAIN}".`);
  const db = getTenantDbFor(tenant.id);

  const users = await db.user.findMany({ where: { tenantId: tenant.id, status: "inactive" }, orderBy: { createdAt: "asc" } });
  console.log(`${users.length} inactive user(s):`);
  for (const u of users) console.log(`  - ${u.name} <${u.email}> role=${u.role} created=${u.createdAt.toISOString()}`);

  let deleted = 0;
  for (const u of users) {
    if (DRY_RUN) continue;
    try {
      await db.user.delete({ where: { id: u.id, tenantId: tenant.id } });
    } catch (err) {
      if (err instanceof Error && err.message.includes("Foreign key constraint")) {
        console.log(`  skipped ${u.email}: still owns records — left inactive`);
        continue;
      }
      throw err;
    }
    if (u.authUserId) {
      const { error } = await getSupabaseAdmin().auth.admin.deleteUser(u.authUserId);
      if (error) console.log(`  ${u.email}: app account deleted, but the login wasn't (${error.message})`);
    }
    deleted++;
    console.log(`  deleted ${u.email}`);
  }
  console.log(DRY_RUN ? "[dry-run] nothing changed." : `Deleted ${deleted} of ${users.length}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
