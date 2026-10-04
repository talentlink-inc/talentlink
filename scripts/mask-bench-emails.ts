// One-off correction: masks any email address still present in imported
// bench submission text fields (the business rule is that bench submission
// emails are never carried into TalentLink — see migrate-bench-sales.ts).
// The first import only masked the Email and Notes columns; one GAS row had
// an email typed into Contact Person. Also reports (doesn't change) emails
// found in bench interviews, for review.
//
// Usage: npx tsx scripts/mask-bench-emails.ts [--dry-run]

import "dotenv/config";
import { prisma } from "../src/lib/db";
import { getTenantDbFor } from "../src/lib/tenantDb";
import { maskEmailsInText } from "../src/lib/maskEmail";

const DRY_RUN = process.argv.includes("--dry-run");
const TENANT_SUBDOMAIN = process.env.DEFAULT_TENANT_SUBDOMAIN ?? "digitallinks";
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const FIELDS = ["companyName", "contactPerson", "contactNumber", "email", "rate", "notes"] as const;

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { subdomain: TENANT_SUBDOMAIN } });
  if (!tenant) throw new Error(`No tenant "${TENANT_SUBDOMAIN}".`);
  const db = getTenantDbFor(tenant.id);

  const subs = await db.benchSubmission.findMany({ where: { tenantId: tenant.id } });
  let changed = 0;
  for (const s of subs) {
    const update: Record<string, string> = {};
    for (const f of FIELDS) {
      const v = s[f];
      if (!v) continue;
      const masked = maskEmailsInText(v);
      if (masked !== v) update[f] = masked;
    }
    if (Object.keys(update).length) {
      changed++;
      console.log(`${DRY_RUN ? "[dry-run] " : ""}${s.submissionCode}: masking ${Object.keys(update).join(", ")}`);
      if (!DRY_RUN) await db.benchSubmission.update({ where: { id: s.id }, data: update });
    }
  }

  const interviews = await db.benchInterview.findMany({ where: { tenantId: tenant.id }, select: { id: true, legacyId: true, clientCompany: true, feedback: true } });
  const interviewHits = interviews.filter((i) => EMAIL.test(i.clientCompany ?? "") || EMAIL.test(i.feedback ?? ""));

  console.log(`\n${DRY_RUN ? "Would mask" : "Masked"} emails in ${changed} bench submission(s).`);
  console.log(`Bench interviews containing an email (not changed): ${interviewHits.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
