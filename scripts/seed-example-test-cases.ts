// One-off: seeds a couple of example TestCase rows for every existing
// tenant, so the new Test Suite page (src/app/(app)/test-suite) isn't an
// empty shell the first time an admin opens it. Safe to re-run — skips a
// tenant that already has any test cases rather than duplicating them.
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { getTenantDbFor } from "../src/lib/tenantDb";

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
  console.log(`Found ${tenants.length} tenant(s).`);

  for (const tenant of tenants) {
    const db = getTenantDbFor(tenant.id);
    const existingCount = await db.testCase.count();
    if (existingCount > 0) {
      console.log(`  ${tenant.name}: already has ${existingCount} test case(s), skipping.`);
      continue;
    }

    await db.testCase.createMany({
      data: [
        {
          tenantId: tenant.id,
          category: "api",
          kind: "api",
          name: "Health check responds",
          description: "Confirms the app's own /api/health route is reachable and returns 200.",
          definition: { path: "/api/health", expectedStatus: 200, bodyContains: '"status":"ok"' },
        },
        {
          tenantId: tenant.id,
          category: "sanity",
          kind: "sanity",
          name: "At least one active user exists",
          description: "Catches a locked-out tenant with nobody able to sign in.",
          definition: { model: "user", filterField: "status", filterEquals: "active", min: 1, max: 100000 },
        },
      ],
    });
    console.log(`  ${tenant.name}: seeded 2 example test cases.`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
