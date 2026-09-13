// One-off: renumbers every Requirement's jobId to a dense, zero-padded
// "JOB-0001" sequence (matching the "SUB-0001"/"PLC-0001" convention already
// used for Submissions/Placements), now that Job ID is auto-generated
// server-side instead of typed in (see requirements/actions.ts's
// generateJobId). Order is preserved — the current numeric portion of each
// jobId (falling back to createdAt for anything that doesn't parse) — just
// made consecutive with no gaps, so history/relative ordering doesn't change.
//
// Includes soft-deleted rows so the new max stays in sync with
// generateJobId's "highest JOB-NNNN on record" logic, and everything else
// only ever references Requirement by its real id (uuid), not jobId — see
// the schema.prisma comment on Submission.requirementJobIdRaw — so this is
// safe with respect to every foreign key in this app.
//
// Usage:
//   npx tsx scripts/renumber-job-ids.ts --dry-run   # preview, writes nothing
//   npx tsx scripts/renumber-job-ids.ts             # applies it

import "dotenv/config";
import { prisma } from "../src/lib/db";
import { getTenantDbFor } from "../src/lib/tenantDb";

const TENANT_SUBDOMAIN = process.env.DEFAULT_TENANT_SUBDOMAIN ?? "digitallinks";
const DRY_RUN = process.argv.includes("--dry-run");

function parseJobIdNumber(jobId: string): number | null {
  const match = jobId.match(/^JOB-(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { subdomain: TENANT_SUBDOMAIN } });
  if (!tenant) {
    throw new Error(`No tenant "${TENANT_SUBDOMAIN}" — check DEFAULT_TENANT_SUBDOMAIN.`);
  }

  // requirements has a Row-Level Security policy requiring app.tenant_id to
  // be set for the session — getTenantDbFor sets it per query, same as the
  // app itself does; the plain `prisma` client above only works here at all
  // because `tenants` is the one table RLS doesn't apply to.
  const db = getTenantDbFor(tenant.id);

  const requirements = await db.requirement.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, jobId: true, jobTitle: true, createdAt: true },
  });

  const ordered = [...requirements].sort((a, b) => {
    const na = parseJobIdNumber(a.jobId);
    const nb = parseJobIdNumber(b.jobId);
    if (na !== null && nb !== null) return na - nb;
    if (na !== null) return -1;
    if (nb !== null) return 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const renumbered = ordered.map((r, i) => ({
    ...r,
    newJobId: `JOB-${String(i + 1).padStart(4, "0")}`,
  }));

  const changed = renumbered.filter((r) => r.jobId !== r.newJobId);
  console.log(`${requirements.length} requirement(s) for tenant "${tenant.name}"`);
  console.log(`${changed.length} will be renumbered:\n`);
  for (const r of changed) {
    console.log(`  ${r.jobId.padEnd(10)} -> ${r.newJobId}   ${r.jobTitle}`);
  }

  if (DRY_RUN) {
    console.log("\nDry run — no changes written. Re-run without --dry-run to apply.");
    return;
  }
  if (changed.length === 0) {
    console.log("\nNothing to do.");
    return;
  }

  // Two passes: renumbering straight to the final value can collide with
  // another row's still-unrenamed current jobId (the (tenantId, jobId)
  // unique constraint), so a collision-free placeholder pass goes first.
  // Each update is its own RLS-scoped statement (see getTenantDbFor), not
  // one big transaction — fine for a one-off, human-supervised run.
  for (const r of changed) {
    await db.requirement.update({
      where: { id: r.id, tenantId: tenant.id },
      data: { jobId: `TMP-${r.id}` },
    });
  }
  for (const r of changed) {
    await db.requirement.update({
      where: { id: r.id, tenantId: tenant.id },
      data: { jobId: r.newJobId },
    });
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
