// One-off: some Requirement/Submission text fields carry raw HTML from the
// original migration (rich text pasted into the GAS app, e.g. from Teams —
// `<span data-teams="true">...`) — the new UI only ever writes plain text
// into these (plain <textarea>, no rich-text editor), so this is purely
// historical contamination, not something the app can produce going
// forward. Strips it so old records read clean too.
//
// Usage:
//   npx tsx scripts/strip-html-from-legacy-text.ts --dry-run   # preview, writes nothing
//   npx tsx scripts/strip-html-from-legacy-text.ts             # applies it

import "dotenv/config";
import { prisma } from "../src/lib/db";
import { getTenantDbFor } from "../src/lib/tenantDb";
import { HTML_TAG_PATTERN, stripHtml } from "./lib/parse";

const TENANT_SUBDOMAIN = process.env.DEFAULT_TENANT_SUBDOMAIN ?? "digitallinks";
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { subdomain: TENANT_SUBDOMAIN } });
  if (!tenant) {
    throw new Error(`No tenant "${TENANT_SUBDOMAIN}" — check DEFAULT_TENANT_SUBDOMAIN.`);
  }
  const db = getTenantDbFor(tenant.id);

  const requirements = await db.requirement.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, jobId: true, jobDescription: true, mandatorySkills: true },
  });
  const submissions = await db.submission.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, submissionId: true, roleWithSkills: true },
  });

  let changedCount = 0;

  for (const r of requirements) {
    const updates: Record<string, string> = {};
    if (r.jobDescription && HTML_TAG_PATTERN.test(r.jobDescription)) {
      updates.jobDescription = stripHtml(r.jobDescription);
    }
    if (r.mandatorySkills && HTML_TAG_PATTERN.test(r.mandatorySkills)) {
      updates.mandatorySkills = stripHtml(r.mandatorySkills);
    }
    if (Object.keys(updates).length === 0) continue;
    changedCount++;
    console.log(`Requirement ${r.jobId}: cleaning ${Object.keys(updates).join(", ")}`);
    if (!DRY_RUN) {
      await db.requirement.update({ where: { id: r.id, tenantId: tenant.id }, data: updates });
    }
  }

  for (const s of submissions) {
    if (!s.roleWithSkills || !HTML_TAG_PATTERN.test(s.roleWithSkills)) continue;
    changedCount++;
    console.log(`Submission ${s.submissionId ?? s.id}: cleaning roleWithSkills`);
    if (!DRY_RUN) {
      await db.submission.update({
        where: { id: s.id, tenantId: tenant.id },
        data: { roleWithSkills: stripHtml(s.roleWithSkills) },
      });
    }
  }

  console.log(`\n${changedCount} record(s) ${DRY_RUN ? "would be" : "were"} cleaned.`);
  if (DRY_RUN) console.log("Dry run — no changes written. Re-run without --dry-run to apply.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
