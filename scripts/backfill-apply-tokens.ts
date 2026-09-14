// One-off: generates a publicApplyToken for every existing requirement that
// doesn't have one yet — new requirements get one automatically at creation
// (see requirements/actions.ts), but the 49 already on record before that
// existed have publicApplyToken = null and would otherwise never show an
// Apply Link in the view modal.
//
// Usage: npx tsx scripts/backfill-apply-tokens.ts

import "dotenv/config";
import { randomBytes } from "node:crypto";
import { prisma } from "../src/lib/db";
import { getTenantDbFor } from "../src/lib/tenantDb";

const TENANT_SUBDOMAIN = process.env.DEFAULT_TENANT_SUBDOMAIN ?? "digitallinks";

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { subdomain: TENANT_SUBDOMAIN } });
  if (!tenant) throw new Error(`No tenant "${TENANT_SUBDOMAIN}" — check DEFAULT_TENANT_SUBDOMAIN.`);
  const db = getTenantDbFor(tenant.id);

  const rows = await db.requirement.findMany({
    where: { tenantId: tenant.id, publicApplyToken: null },
    select: { id: true, jobId: true },
  });

  console.log(`${rows.length} requirement(s) missing a publicApplyToken.`);
  for (const r of rows) {
    await db.requirement.update({
      where: { id: r.id, tenantId: tenant.id },
      data: { publicApplyToken: randomBytes(16).toString("hex") },
    });
    console.log(`  ${r.jobId}: token assigned`);
  }
  console.log("\nDone.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
